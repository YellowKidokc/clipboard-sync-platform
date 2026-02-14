#Requires AutoHotkey v2.0
A_IconTip := "ClipSync"
TraySetIcon("shell32.dll", 44)
A_TrayMenu.Add("Open ClipSync", (*) => Run("http://localhost:5000"))
A_TrayMenu.Add("Exit", (*) => ExitApp())
