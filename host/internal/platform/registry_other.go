//go:build !windows

package platform

// SetRegistryDefault 只在 Windows 上使用。
func SetRegistryDefault(key, value string) error { return nil }

// RegistryDefault 只在 Windows 上使用。
func RegistryDefault(key string) (string, error) { return "", nil }

// DeleteRegistryKey 只在 Windows 上使用。
func DeleteRegistryKey(key string) error { return nil }
