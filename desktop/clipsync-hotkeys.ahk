#Requires AutoHotkey v2.0
#SingleInstance Force

base := "http://localhost:5000"
; Optional: set your JWT token here if auth is enabled
apiToken := ""

HttpRequest(method, url, body := "") {
    global apiToken
    req := ComObject("WinHttp.WinHttpRequest.5.1")
    req.Open(method, url, false)
    if (body != "") {
        req.SetRequestHeader("Content-Type", "application/json")
    }
    if (apiToken != "") {
        req.SetRequestHeader("Authorization", "Bearer " apiToken)
    }
    req.Send(body)
    return req.ResponseText
}

HttpGet(url) {
    return HttpRequest("GET", url)
}

HttpPost(url, body) {
    return HttpRequest("POST", url, body)
}

PasteSlot(slot) {
    global base
    response := HttpGet(base "/api/clips/hotkeys")
    data := Jxon_Load(&response)
    clip := data["slots"][String(slot)]
    if IsObject(clip) {
        A_Clipboard := clip["textContent"]
        Send "^v"
    }
}

SaveToNextSlot() {
    global base
    response := HttpGet(base "/api/clips/hotkeys")
    data := Jxon_Load(&response)
    slots := data["slots"]
    nextSlot := 0
    Loop 12 {
        if !slots.Has(String(A_Index)) {
            nextSlot := A_Index
            break
        }
    }
    if (nextSlot = 0) {
        ToolTip "No empty hotkey slots"
        SetTimer () => ToolTip(), -1200
        return
    }

    payload := Jxon_Dump({ content_type: "text/plain", text_content: A_Clipboard, source: "clipboard_monitor" })
    created := HttpPost(base "/api/clips", payload)
    clip := Jxon_Load(&created)
    if IsObject(clip) {
        HttpPost(base "/api/clips/hotkeys", Jxon_Dump({ clip_id: clip["id"], slot: nextSlot }))
        ToolTip "Saved to slot " nextSlot
        SetTimer () => ToolTip(), -1200
    }
}

ShowPrediction() {
    global base
    response := HttpGet(base "/api/predictions/current")
    data := Jxon_Load(&response)
    ToolTip "Prediction: " data["prediction"]
    SetTimer () => ToolTip(), -1500
}

OnClipboardChange ClipChanged

ClipChanged(type) {
    global base
    if (type != 1)
        return
    if (A_Clipboard = "")
        return
    payload := Jxon_Dump({ content_type: "text/plain", text_content: A_Clipboard, source: "clipboard_monitor" })
    HttpPost(base "/api/clips", payload)
    ToolTip "ClipSync saved"
    SetTimer () => ToolTip(), -800
}

^!1::PasteSlot(1)
^!2::PasteSlot(2)
^!3::PasteSlot(3)
^!4::PasteSlot(4)
^!5::PasteSlot(5)
^!6::PasteSlot(6)
^!7::PasteSlot(7)
^!8::PasteSlot(8)
^!9::PasteSlot(9)
^!0::PasteSlot(10)
^!-::PasteSlot(11)
^!=::PasteSlot(12)

^!s::SaveToNextSlot()
^!p::ShowPrediction()
^!Space::Run "http://localhost:5000"

; --- Jxon JSON helpers (trimmed for AHK v2) ---
; Source: https://github.com/cocobelgica/AutoHotkey-JSON

Jxon_Load(&src, args*) {
    static q := Chr(34)
    static json := { true: true, false: false, null: "" }
    pos := 1
    return __Jxon_Value(src, pos)
}

__Jxon_Value(ByRef src, ByRef pos) {
    static q := Chr(34)
    __Jxon_Skip(src, pos)
    ch := SubStr(src, pos, 1)
    if (ch = q)
        return __Jxon_String(src, pos)
    if (ch = "{")
        return __Jxon_Object(src, pos)
    if (ch = "[")
        return __Jxon_Array(src, pos)
    return __Jxon_Primitive(src, pos)
}

__Jxon_Object(ByRef src, ByRef pos) {
    obj := Map()
    pos++
    loop {
        __Jxon_Skip(src, pos)
        if (SubStr(src, pos, 1) = "}") {
            pos++
            break
        }
        key := __Jxon_String(src, pos)
        __Jxon_Skip(src, pos)
        pos++
        value := __Jxon_Value(src, pos)
        obj[key] := value
        __Jxon_Skip(src, pos)
        ch := SubStr(src, pos, 1)
        if (ch = ",") {
            pos++
            continue
        }
        if (ch = "}") {
            pos++
            break
        }
    }
    return obj
}

__Jxon_Array(ByRef src, ByRef pos) {
    arr := []
    pos++
    loop {
        __Jxon_Skip(src, pos)
        if (SubStr(src, pos, 1) = "]") {
            pos++
            break
        }
        arr.Push(__Jxon_Value(src, pos))
        __Jxon_Skip(src, pos)
        ch := SubStr(src, pos, 1)
        if (ch = ",") {
            pos++
            continue
        }
        if (ch = "]") {
            pos++
            break
        }
    }
    return arr
}

__Jxon_String(ByRef src, ByRef pos) {
    static q := Chr(34)
    pos++
    out := ""
    loop {
        ch := SubStr(src, pos, 1)
        if (ch = q) {
            pos++
            break
        }
        if (ch = "\\") {
            pos++
            esc := SubStr(src, pos, 1)
            if (esc = "u") {
                hex := SubStr(src, pos + 1, 4)
                out .= Chr("0x" hex)
                pos += 5
                continue
            }
            map := Map("\"", q, "\\", "\\", "/", "/", "b", "`b", "f", "`f", "n", "`n", "r", "`r", "t", "`t")
            out .= map.Has(esc) ? map[esc] : esc
            pos++
            continue
        }
        out .= ch
        pos++
    }
    return out
}

__Jxon_Primitive(ByRef src, ByRef pos) {
    match := RegExMatch(SubStr(src, pos), "^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)", &m)
    if (!match)
        return ""
    pos += StrLen(m[1])
    if (m[1] = "true")
        return true
    if (m[1] = "false")
        return false
    if (m[1] = "null")
        return ""
    return m[1] + 0
}

__Jxon_Skip(ByRef src, ByRef pos) {
    while (pos <= StrLen(src) && InStr(" `t`r`n", SubStr(src, pos, 1)))
        pos++
}

Jxon_Dump(obj) {
    if IsObject(obj) {
        if obj is Array {
            out := "["
            for index, val in obj
                out .= (index > 1 ? "," : "") Jxon_Dump(val)
            return out "]"
        }
        out := "{"
        first := true
        for key, val in obj {
            if (!first)
                out .= ","
            first := false
            out .= "\"" __Jxon_Escape(key) "\":" Jxon_Dump(val)
        }
        return out "}"
    }
    if (obj = true)
        return "true"
    if (obj = false)
        return "false"
    if (obj = "")
        return "null"
    if obj is Number
        return obj
    return "\"" __Jxon_Escape(obj) "\""
}

__Jxon_Escape(str) {
    str := StrReplace(str, "\\", "\\\\")
    str := StrReplace(str, "\"", "\\\"")
    str := StrReplace(str, "`b", "\\b")
    str := StrReplace(str, "`f", "\\f")
    str := StrReplace(str, "`n", "\\n")
    str := StrReplace(str, "`r", "\\r")
    str := StrReplace(str, "`t", "\\t")
    return str
}
