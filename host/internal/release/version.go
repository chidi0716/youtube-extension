package release

import (
	"strconv"
	"strings"
)

// Version 是 x.y.z 或 x.y.z-<預先發行標記> 形式的版本號。
type Version struct {
	Major, Minor, Patch int
	Pre                 string
}

// ParseVersion 解析版本號（可以有開頭的 v）。
func ParseVersion(s string) (Version, bool) {
	s = strings.TrimPrefix(s, "v")
	core, pre, hasPre := strings.Cut(s, "-")
	if hasPre && (pre == "" || !versionRe.MatchString(pre)) {
		return Version{}, false
	}
	parts := strings.Split(core, ".")
	if len(parts) != 3 {
		return Version{}, false
	}
	var n [3]int
	for i, p := range parts {
		if p == "" || len(p) > 9 || (len(p) > 1 && p[0] == '0') {
			return Version{}, false
		}
		v, err := strconv.Atoi(p)
		if err != nil || v < 0 {
			return Version{}, false
		}
		n[i] = v
	}
	return Version{Major: n[0], Minor: n[1], Patch: n[2], Pre: pre}, true
}

// Compare 比較兩個版本：a < b 回傳 -1，相等回傳 0，a > b 回傳 1。
// 數字逐段比較（0.10.0 > 0.9.0）；同一版本中，有預先發行標記的比正式版本舊。
func (a Version) Compare(b Version) int {
	for _, d := range [][2]int{{a.Major, b.Major}, {a.Minor, b.Minor}, {a.Patch, b.Patch}} {
		if d[0] != d[1] {
			if d[0] < d[1] {
				return -1
			}
			return 1
		}
	}
	switch {
	case a.Pre == b.Pre:
		return 0
	case a.Pre == "":
		return 1
	case b.Pre == "":
		return -1
	case a.Pre < b.Pre:
		return -1
	}
	return 1
}

// Newer 回傳 candidate 是否比 current 新。任一方無法解析時回傳 false（例如開發版 "dev"）。
func Newer(candidate, current string) bool {
	c, ok1 := ParseVersion(candidate)
	cur, ok2 := ParseVersion(current)
	return ok1 && ok2 && c.Compare(cur) > 0
}
