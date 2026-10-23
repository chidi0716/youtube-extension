//go:build windows

package platform

import (
	"errors"

	"golang.org/x/sys/windows/registry"
)

// SetRegistryDefault 在 HKCU\<key> 建立機碼並把預設值設為 value（原生訊息設定檔的路徑）。
func SetRegistryDefault(key, value string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, key, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue("", value)
}

// RegistryDefault 讀取 HKCU\<key> 的預設值；機碼不存在時回傳空字串。
func RegistryDefault(key string) (string, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, key, registry.QUERY_VALUE)
	if errors.Is(err, registry.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	defer k.Close()
	v, _, err := k.GetStringValue("")
	if errors.Is(err, registry.ErrNotExist) {
		return "", nil
	}
	return v, err
}

// DeleteRegistryKey 刪除 HKCU\<key>（沒有子機碼）；不存在時不算錯誤。
func DeleteRegistryKey(key string) error {
	err := registry.DeleteKey(registry.CURRENT_USER, key)
	if errors.Is(err, registry.ErrNotExist) {
		return nil
	}
	return err
}
