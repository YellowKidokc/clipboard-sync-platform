#Requires AutoHotkey v2.0
#SingleInstance Force

; ClipSync hotkeys
;
; Ctrl+Alt+1..0, -, =   paste the clip in hotkey slot 1..12
; Ctrl+Alt+S            save the current clipboard into the next free slot
; Ctrl+Alt+P            show the current prediction
; Ctrl+Alt+Space        open the ClipSync web UI
; Ctrl+Alt+Q            pause/resume clipboard capture
;
; Setup:
;   1. Point BASE_URL at your server. On a Synology the stack publishes 5055,
;      not 5000 -- DSM owns 5000/5001.
;   2. Get an API key:  POST /api/auth/api-key  with your login token.
;      Put it in API_KEY below, or set a CLIPSYNC_API_KEY environment variable
;      so the key is not sitting in a file.
;
; Every endpoint this script calls returns text/plain, so there is no JSON
; parsing here at all.

BASE_URL := "http://192.168.1.177:5055"
API_KEY := EnvGet("CLIPSYNC_API_KEY")

; Set to false to stop sending every copy to the server. Ctrl+Alt+Q toggles it.
captureEnabled := true

; Raised while the script writes to the clipboard itself. Without it, pasting a
; slot fires OnClipboardChange, which POSTs the clip straight back to the
; server and creates a duplicate on every paste.
suppressCapture := false

if (API_KEY = "") {
    MsgBox "ClipSync: no API key.`n`nSet CLIPSYNC_API_KEY in your environment, or edit API_KEY in " A_ScriptName ".`n`nGet a key with: POST " BASE_URL "/api/auth/api-key", "ClipSync", "Iconx"
    ExitApp
}

; --- HTTP ---------------------------------------------------------------

/**
 * Returns a Map with "status" and "text". Never throws: a hotkey that raises
 * an uncaught error in AutoHotkey pops a dialog over whatever you were doing.
 */
Http(method, path, body := "") {
    global BASE_URL, API_KEY
    result := Map("status", 0, "text", "")
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open(method, BASE_URL path, false)
        req.SetTimeouts(5000, 5000, 5000, 15000)
        req.SetRequestHeader("X-API-Key", API_KEY)
        if (body != "") {
            req.SetRequestHeader("Content-Type", "text/plain; charset=utf-8")
        }
        req.Send(body)
        result["status"] := req.Status
        result["text"] := req.ResponseText
    } catch as err {
        result["status"] := 0
        result["text"] := err.Message
    }
    return result
}

Toast(message, duration := 1200) {
    ToolTip message
    SetTimer(() => ToolTip(), -duration)
}

/** Reports a failed call in a way that says which one failed and why. */
ToastFailure(what, result) {
    global BASE_URL
    if (result["status"] = 0) {
        Toast "ClipSync: cannot reach " BASE_URL, 2500
    } else if (result["status"] = 401) {
        Toast "ClipSync: API key rejected (401)", 2500
    } else {
        Toast "ClipSync: " what " failed (" result["status"] ") " SubStr(result["text"], 1, 80), 2500
    }
}

/** Writes to the clipboard without the write coming back as a new clip. */
SetClipboardQuietly(textValue) {
    global suppressCapture
    suppressCapture := true
    A_Clipboard := textValue
    ; OnClipboardChange is delivered asynchronously, so the flag has to outlive
    ; this function by long enough for the notification to arrive.
    SetTimer(() => ReleaseCaptureSuppression(), -500)
}

ReleaseCaptureSuppression() {
    global suppressCapture
    suppressCapture := false
}

; --- Actions ------------------------------------------------------------

PasteSlot(slot) {
    result := Http("GET", "/api/clips/hotkeys/" slot "/text")
    if (result["status"] = 404) {
        Toast "Slot " slot " is empty"
        return
    }
    if (result["status"] != 200) {
        ToastFailure("slot " slot, result)
        return
    }
    SetClipboardQuietly(result["text"])
    ; Give Windows a moment to publish the new clipboard contents before the
    ; target application is told to read them.
    Sleep 60
    Send "^v"
}

SaveToNextSlot() {
    if (A_Clipboard = "") {
        Toast "Clipboard is empty"
        return
    }
    result := Http("POST", "/api/clips/hotkeys/next", A_Clipboard)
    if (result["status"] = 409) {
        Toast "All 12 hotkey slots are full", 2000
        return
    }
    if (result["status"] != 200) {
        ToastFailure("save", result)
        return
    }
    Toast "Saved to slot " result["text"]
}

ShowPrediction() {
    result := Http("GET", "/api/predictions/current/text")
    if (result["status"] != 200) {
        ToastFailure("prediction", result)
        return
    }
    if (result["text"] = "") {
        Toast "No prediction yet"
        return
    }
    Toast "Prediction: " result["text"], 2500
}

OpenWebUi() {
    global BASE_URL
    Run BASE_URL
}

ToggleCapture() {
    global captureEnabled
    captureEnabled := !captureEnabled
    Toast(captureEnabled ? "ClipSync capture ON" : "ClipSync capture OFF")
}

; --- Clipboard capture --------------------------------------------------

OnClipboardChange ClipChanged

ClipChanged(dataType) {
    global captureEnabled, suppressCapture
    if (dataType != 1)          ; 1 = text; images are not handled here
        return
    if (!captureEnabled)
        return
    if (suppressCapture)        ; this script wrote the clipboard, not the user
        return
    if (A_Clipboard = "")
        return
    ; /api/clips/text stores the clip without assigning a hotkey slot. Posting
    ; to /hotkeys/next here would burn all twelve slots within a minute of
    ; normal copying.
    result := Http("POST", "/api/clips/text", A_Clipboard)
    if (result["status"] = 201) {
        Toast "ClipSync saved", 800
    } else {
        ToastFailure("capture", result)
    }
}

; --- Hotkeys ------------------------------------------------------------

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
^!q::ToggleCapture()
^!Space::OpenWebUi()
