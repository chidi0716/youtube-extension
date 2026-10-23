package release

import "crypto/ed25519"

// PublicKeyBase64 是驗證 components.json.sig 的 Ed25519 公鑰（plan 4.9）。
//
// 專案擁有者第一次設定時執行：
//
//	cd host && go run ./cmd/yte-release keygen -out <repo 以外的路徑>/release-signing.key
//
// 把印出的公鑰貼到下面的引號中並 commit，私鑰檔案的內容存到 GitHub Secret RELEASE_SIGNING_KEY
// （README「維護者」章節）。發佈流程會確認 Secret 的私鑰與這裡的公鑰相符，不相符時停止發佈。
//
// 這是 var 而不是 const，只為了讓 `npm run release:dry` 能以 -ldflags -X 換成臨時的測試公鑰；
// 正式版本一律使用這裡的值。空字串代表尚未設定：此時 --install 與自動更新都會以
// SIGNATURE_INVALID 拒絕所有清單。
var PublicKeyBase64 = ""

// BuiltinPublicKey 回傳內建公鑰。
func BuiltinPublicKey() (ed25519.PublicKey, error) { return ParsePublicKey(PublicKeyBase64) }
