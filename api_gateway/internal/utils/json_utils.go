
package utils

import (
	"encoding/json"
	"io"
)

func ParseJSON(reader io.Reader, target interface{}) error {
	return json.NewDecoder(reader).Decode(target)
}

func MarshalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}