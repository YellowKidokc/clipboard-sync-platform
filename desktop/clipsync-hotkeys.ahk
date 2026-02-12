#Requires AutoHotkey v2.0
base := "http://localhost:5000"

PasteSlot(slot) {
    global base
    response := Download(base "/api/clips/hotkeys")
    data := Jxon_Load(&response)
    clip := data["slots"][String(slot)]
    if IsObject(clip) {
        A_Clipboard := clip["textContent"]
        Send "^v"
    }
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

^!s::{
    payload := '{"content_type":"text/plain","text_content":' . Jxon_Dump(A_Clipboard) . ',"source":"clipboard_monitor"}'
    PostJson(base "/api/clips", payload)
}

^!p::{
    response := Download(base "/api/predictions/current")
    data := Jxon_Load(&response)
    ToolTip "Prediction: " data["prediction"]
    SetTimer () => ToolTip(), -1500
}

^!Space::Run "http://localhost:5000"

; Note: helper funcs Download/PostJson/Jxon_* should be provided by your JSON/HTTP include library.
