// yte-release 是維護者與發佈流程使用的工具（plan 4.9、4.10），不會發佈給使用者。
//
//	keygen    -out <檔案>                         產生簽章金鑰：私鑰寫到檔案（權限 600），印出公鑰
//	pubkey    (-key-file <檔案> | -key-env <變數>)  印出私鑰對應的公鑰
//	check-key (-key-file <檔案> | -key-env <變數>) [-pubkey <base64>]
//	                                              確認私鑰與公鑰（預設為小幫手內建的公鑰）相符
//	sign      (-key-file | -key-env) -in components.json -out components.json.sig
//	verify    -in components.json -sig components.json.sig [-pubkey <base64>]
//	lock-check [-lock release/components.lock.json] [-online] [-download]
//	                                              檢查 lock 檔；-online 時與官方檢查碼比對，
//	                                              -download 時另外下載每個檔案計算 SHA256
//	manifest  -lock <lock> -version <x.y.z> -tag <vx.y.z> -helpers <資料夾> -out components.json
//	zip       -dir <資料夾> -out <檔案.zip>         把資料夾壓縮成 zip（保留執行權限）
//
// 私鑰不會出現在命令列參數中：從檔案或環境變數（GitHub Secret）讀取。
package main

import (
	"archive/zip"
	"context"
	"crypto/ed25519"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/chidi0716/youtube-extension/host/internal/release"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch cmd, args := os.Args[1], os.Args[2:]; cmd {
	case "keygen":
		err = keygen(args)
	case "pubkey":
		err = pubkey(args)
	case "check-key":
		err = checkKey(args)
	case "sign":
		err = sign(args)
	case "verify":
		err = verify(args)
	case "lock-check":
		err = lockCheck(args)
	case "manifest":
		err = manifest(args)
	case "zip":
		err = zipDir(args)
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "yte-release:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: yte-release keygen|pubkey|check-key|sign|verify|lock-check|manifest|zip [flags]")
}

func keygen(args []string) error {
	fl := flag.NewFlagSet("keygen", flag.ExitOnError)
	out := fl.String("out", "", "file to write the private key to (must not exist)")
	fl.Parse(args)
	if *out == "" {
		return errors.New("-out is required")
	}
	pub, priv, err := release.GenerateKey()
	if err != nil {
		return err
	}
	f, err := os.OpenFile(*out, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("could not create %s (it must not exist yet): %w", *out, err)
	}
	if _, err := f.WriteString(priv + "\n"); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Private key written to %s. Store its content in the GitHub secret RELEASE_SIGNING_KEY, then keep the file offline or delete it.\n", *out)
	fmt.Fprintln(os.Stderr, "Public key (paste into host/internal/release/pubkey.go):")
	fmt.Println(pub)
	return nil
}

type keyFlags struct {
	file, env *string
}

func addKeyFlags(fl *flag.FlagSet) keyFlags {
	return keyFlags{
		file: fl.String("key-file", "", "file that contains the private key"),
		env:  fl.String("key-env", "", "environment variable that contains the private key (e.g. RELEASE_SIGNING_KEY)"),
	}
}

func (k keyFlags) load() (ed25519.PrivateKey, error) {
	var s string
	switch {
	case *k.file != "" && *k.env != "":
		return nil, errors.New("use either -key-file or -key-env")
	case *k.file != "":
		b, err := os.ReadFile(*k.file)
		if err != nil {
			return nil, err
		}
		s = string(b)
	case *k.env != "":
		s = os.Getenv(*k.env)
		if strings.TrimSpace(s) == "" {
			return nil, fmt.Errorf("environment variable %s is empty", *k.env)
		}
	default:
		return nil, errors.New("-key-file or -key-env is required")
	}
	return release.ParsePrivateKey(s)
}

func pubkey(args []string) error {
	fl := flag.NewFlagSet("pubkey", flag.ExitOnError)
	k := addKeyFlags(fl)
	fl.Parse(args)
	priv, err := k.load()
	if err != nil {
		return err
	}
	fmt.Println(release.PublicKeyOf(priv))
	return nil
}

func checkKey(args []string) error {
	fl := flag.NewFlagSet("check-key", flag.ExitOnError)
	k := addKeyFlags(fl)
	pub := fl.String("pubkey", "", "expected public key (default: the one built into the helper)")
	fl.Parse(args)
	priv, err := k.load()
	if err != nil {
		return err
	}
	want := *pub
	if want == "" {
		want = release.PublicKeyBase64
	}
	if strings.TrimSpace(want) == "" {
		return errors.New("host/internal/release/pubkey.go has no public key yet; run keygen and commit the public key first")
	}
	if got := release.PublicKeyOf(priv); got != strings.TrimSpace(want) {
		return fmt.Errorf("the signing key does not match the public key (signing key's public key: %s)", got)
	}
	fmt.Println("ok: the signing key matches the public key")
	return nil
}

func sign(args []string) error {
	fl := flag.NewFlagSet("sign", flag.ExitOnError)
	k := addKeyFlags(fl)
	in := fl.String("in", "", "components.json")
	out := fl.String("out", "", "components.json.sig")
	fl.Parse(args)
	if *in == "" || *out == "" {
		return errors.New("-in and -out are required")
	}
	priv, err := k.load()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(*in)
	if err != nil {
		return err
	}
	if _, err := release.ParseManifest(data, release.AllowedURL); err != nil {
		return err
	}
	return os.WriteFile(*out, release.Sign(priv, data), 0o644)
}

func verify(args []string) error {
	fl := flag.NewFlagSet("verify", flag.ExitOnError)
	in := fl.String("in", "", "components.json")
	sigPath := fl.String("sig", "", "components.json.sig")
	pubFlag := fl.String("pubkey", "", "public key (default: the one built into the helper)")
	fl.Parse(args)
	if *in == "" || *sigPath == "" {
		return errors.New("-in and -sig are required")
	}
	p := *pubFlag
	if p == "" {
		p = release.PublicKeyBase64
	}
	pub, err := release.ParsePublicKey(p)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(*in)
	if err != nil {
		return err
	}
	sig, err := os.ReadFile(*sigPath)
	if err != nil {
		return err
	}
	m, err := release.VerifyAndParse(pub, data, sig, release.AllowedURL)
	if err != nil {
		return err
	}
	fmt.Printf("ok: components.json %s is signed and valid\n", m.Version)
	return nil
}

func lockCheck(args []string) error {
	fl := flag.NewFlagSet("lock-check", flag.ExitOnError)
	lockPath := fl.String("lock", filepath.Join("..", "release", "components.lock.json"), "lock file")
	online := fl.Bool("online", false, "compare with the official checksum files")
	download := fl.Bool("download", false, "also download every file and check its SHA256 (implies -online)")
	fl.Parse(args)
	data, err := os.ReadFile(*lockPath)
	if err != nil {
		return err
	}
	l, err := release.ParseLock(data)
	if err != nil {
		return err
	}
	fmt.Printf("ok: %s is valid (yt-dlp %s, deno %s, ffmpeg %s)\n", *lockPath,
		l.Tools[release.ToolYtDlp].Version, l.Tools[release.ToolDeno].Version, l.Tools[release.ToolFFmpeg].Version)
	if !*online && !*download {
		return nil
	}
	tmp, err := os.MkdirTemp("", "yte-lock-check-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	logf := func(format string, a ...any) { fmt.Printf(format+"\n", a...) }
	return l.VerifyOnline(context.Background(), release.NewFetcher("release"), *download, tmp, logf)
}

func manifest(args []string) error {
	fl := flag.NewFlagSet("manifest", flag.ExitOnError)
	lockPath := fl.String("lock", filepath.Join("..", "release", "components.lock.json"), "lock file")
	version := fl.String("version", "", "release version (x.y.z)")
	tag := fl.String("tag", "", "release tag (vx.y.z)")
	helpers := fl.String("helpers", "", "folder with yte-host-darwin-arm64, yte-host-darwin-amd64, yte-host-windows-amd64.exe")
	out := fl.String("out", "", "components.json to write")
	fl.Parse(args)
	if *version == "" || *helpers == "" || *out == "" {
		return errors.New("-version, -helpers and -out are required")
	}
	if *tag == "" {
		*tag = "v" + *version
	}
	data, err := os.ReadFile(*lockPath)
	if err != nil {
		return err
	}
	l, err := release.ParseLock(data)
	if err != nil {
		return err
	}
	m, err := release.BuildManifest(l, *version, *tag, *helpers)
	if err != nil {
		return err
	}
	b, err := m.Marshal()
	if err != nil {
		return err
	}
	return os.WriteFile(*out, b, 0o644)
}

func zipDir(args []string) error {
	fl := flag.NewFlagSet("zip", flag.ExitOnError)
	dir := fl.String("dir", "", "folder to compress (its name becomes the top folder in the zip)")
	out := fl.String("out", "", "zip file to write")
	fl.Parse(args)
	if *dir == "" || *out == "" {
		return errors.New("-dir and -out are required")
	}
	f, err := os.Create(*out)
	if err != nil {
		return err
	}
	zw := zip.NewWriter(f)
	root := filepath.Clean(*dir)
	top := filepath.Base(root)
	err = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, err := filepath.Rel(root, p)
		if err != nil {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		h, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		h.Name = top + "/" + filepath.ToSlash(rel)
		h.Method = zip.Deflate
		w, err := zw.CreateHeader(h)
		if err != nil {
			return err
		}
		src, err := os.Open(p)
		if err != nil {
			return err
		}
		defer src.Close()
		_, err = io.Copy(w, src)
		return err
	})
	if cerr := zw.Close(); err == nil {
		err = cerr
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	return err
}
