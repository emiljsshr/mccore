package bridge

import "testing"

func TestParseExtractsPayloadDespiteLoggerPrefix(t *testing.T) {
	line := `[19:32:10 INFO]: [mcCoreBridge] [MCBRIDGE] {"type":"achievement","uuid":"069a79f4-44e9-4726-a5be-fca90e38aaf5","player":"Steve","title":"Stone Age"}`
	data, ok := Parse(line)
	if !ok {
		t.Fatal("expected ok=true")
	}
	if String(data, "type") != "achievement" || String(data, "player") != "Steve" || String(data, "title") != "Stone Age" {
		t.Errorf("got %+v", data)
	}
}

func TestParseIgnoresUnrelatedLines(t *testing.T) {
	lines := []string{
		"[19:32:10 INFO]: Steve joined the game",
		"[19:32:10 WARN]: Can't keep up!",
		"",
		"[19:32:10 INFO]: [mcCoreBridge] mcCoreBridge ready.",
	}
	for _, l := range lines {
		if _, ok := Parse(l); ok {
			t.Errorf("Parse(%q) = ok, want not-ok", l)
		}
	}
}

func TestParseRejectsMalformedJSON(t *testing.T) {
	if _, ok := Parse(`[MCBRIDGE] {not valid json`); ok {
		t.Error("expected ok=false for malformed JSON")
	}
}

func TestParseNestedArraysAndObjects(t *testing.T) {
	line := `[MCBRIDGE] {"type":"inventory","requestId":"01ABC","player":"Steve","hotbar":[{"itemId":"minecraft:diamond_sword","count":1},null]}`
	data, ok := Parse(line)
	if !ok {
		t.Fatal("expected ok=true")
	}
	hotbar, isSlice := data["hotbar"].([]any)
	if !isSlice || len(hotbar) != 2 {
		t.Fatalf("hotbar = %+v, want a 2-element slice", data["hotbar"])
	}
	if hotbar[1] != nil {
		t.Errorf("hotbar[1] = %+v, want nil", hotbar[1])
	}
}
