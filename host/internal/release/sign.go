package release

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

// 簽章：Ed25519（plan 4.9）。
//
//   - 私鑰：32 位元組的種子，以標準 base64 表示（一行文字）。只存在 GitHub Secret
//     RELEASE_SIGNING_KEY 或維護者自己的檔案中，不得進 repo。
//   - 公鑰：32 位元組，以標準 base64 表示，內建在 pubkey.go。
//   - components.json.sig：對 components.json 原始位元組的簽章（64 位元組），以標準 base64 表示，
//     檔案內容只有這一行（結尾換行可有可無）。

// ErrNoPublicKey 表示這個小幫手沒有內建公鑰（專案擁有者尚未產生簽章金鑰）。
var ErrNoPublicKey = errors.New("this helper has no release public key; see README (Maintainers)")

// ErrBadSignature 表示簽章不正確。
var ErrBadSignature = errors.New("the signature of components.json is not valid")

// GenerateKey 產生新的金鑰對，回傳（公鑰 base64, 私鑰種子 base64）。
func GenerateKey() (pub, priv string, err error) {
	p, k, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(p), base64.StdEncoding.EncodeToString(k.Seed()), nil
}

// ParsePrivateKey 解析私鑰種子（base64）。
func ParsePrivateKey(s string) (ed25519.PrivateKey, error) {
	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(s))
	if err != nil || len(b) != ed25519.SeedSize {
		return nil, errors.New("the signing key must be a base64-encoded 32-byte Ed25519 seed")
	}
	return ed25519.NewKeyFromSeed(b), nil
}

// ParsePublicKey 解析公鑰（base64）。
func ParsePublicKey(s string) (ed25519.PublicKey, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, ErrNoPublicKey
	}
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil || len(b) != ed25519.PublicKeySize {
		return nil, errors.New("the public key must be a base64-encoded 32-byte Ed25519 key")
	}
	return ed25519.PublicKey(b), nil
}

// PublicKeyOf 回傳私鑰對應的公鑰（base64）。
func PublicKeyOf(priv ed25519.PrivateKey) string {
	return base64.StdEncoding.EncodeToString(priv.Public().(ed25519.PublicKey))
}

// Sign 對 data 簽章，回傳 .sig 檔案的內容。
func Sign(priv ed25519.PrivateKey, data []byte) []byte {
	return []byte(base64.StdEncoding.EncodeToString(ed25519.Sign(priv, data)) + "\n")
}

// Verify 以公鑰驗證 .sig 檔案的內容。
func Verify(pub ed25519.PublicKey, data, sig []byte) error {
	if len(pub) != ed25519.PublicKeySize {
		return ErrNoPublicKey
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(sig)))
	if err != nil || len(raw) != ed25519.SignatureSize {
		return fmt.Errorf("%w (malformed signature file)", ErrBadSignature)
	}
	if !ed25519.Verify(pub, data, raw) {
		return ErrBadSignature
	}
	return nil
}

// VerifyAndParse 驗證簽章後解析清單。簽章不正確時不會解析內容。
func VerifyAndParse(pub ed25519.PublicKey, data, sig []byte, allow URLCheck) (*Manifest, error) {
	if err := Verify(pub, data, sig); err != nil {
		return nil, err
	}
	return ParseManifest(data, allow)
}
