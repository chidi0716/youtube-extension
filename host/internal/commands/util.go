package commands

import (
	"bytes"
	"encoding/json"
	"io"
)

func bytesReader(raw json.RawMessage) io.Reader {
	if len(raw) == 0 {
		raw = json.RawMessage("{}")
	}
	return bytes.NewReader(raw)
}
