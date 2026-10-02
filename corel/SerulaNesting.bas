Attribute VB_Name = "SerulaNesting"
Option Explicit

' Serula Nesting Pro - CorelDRAW offline bridge
' No WinAPI declarations are used, so the same module can be used in
' old 32-bit and new 64-bit CorelDRAW installations.

Private Const DXF_FILTER As Long = 1296
Private Const EXPORT_SELECTION As Long = 2

Public Sub Serula_Gonder()
    Dim inputPath As String
    Dim outputPath As String
    Dim exePath As String
    
    If Not HasActiveDocument() Then
        MsgBox "Acik bir CorelDRAW belgesi bulunamadi.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    If SelectionCount() <= 0 Then
        MsgBox "Serula'ya gondermek istediginiz parcalari secin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    exePath = FindSerulaDesktop()
    If Len(exePath) = 0 Then
        MsgBox "Serula Nesting Pro PC bulunamadi." & vbCrLf & _
               "Once Serula Nesting Pro PC'yi kurup bir kez acin.", vbCritical, "Serula Nesting"
        Exit Sub
    End If
    
    If Not CreateBridgePaths(inputPath, outputPath) Then
        MsgBox "Serula gecici klasoru olusturulamadi.", vbCritical, "Serula Nesting"
        Exit Sub
    End If
    
    If Not ExportSelectionDXF(inputPath) Then
        MsgBox "Secim DXF olarak disari aktarilamadi.", vbCritical, "Serula Nesting"
        Exit Sub
    End If
    
    WriteText BridgeRoot() & "\last-output.txt", outputPath
    WriteText BridgeRoot() & "\last-input.txt", inputPath
    
    LaunchSerula exePath, inputPath, outputPath
    
    MsgBox "Secili parcalar Serula'ya gonderildi." & vbCrLf & vbCrLf & _
           "Serula'da nesting'i tamamlayip DXF Indir'e basin." & vbCrLf & _
           "Sonra CorelDRAW'da Serula_Sonucu_Al makrosunu calistirin.", _
           vbInformation, "Serula Nesting"
End Sub

Public Sub Serula_Sonucu_Al()
    Dim outputPath As String
    outputPath = ReadText(BridgeRoot() & "\last-output.txt")
    
    If Len(outputPath) = 0 Then
        MsgBox "Bekleyen Serula sonucu bulunamadi.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    If Not FileExists(outputPath) Then
        MsgBox "Serula sonucu henuz hazir degil." & vbCrLf & _
               "Serula'da DXF Indir'e bastiginizdan emin olun.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    If Not HasActiveDocument() Then
        MsgBox "Sonucu almak icin once bir CorelDRAW belgesi acin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    If ImportResultDXF(outputPath) Then
        MsgBox "Serula nesting sonucu CorelDRAW'a alindi.", vbInformation, "Serula Nesting"
    Else
        MsgBox "DXF sonucu CorelDRAW'a aktarilamadi.", vbCritical, "Serula Nesting"
    End If
End Sub

Public Sub Serula_Klasoru_Ac()
    Dim folderPath As String
    folderPath = BridgeRoot()
    EnsureFolder folderPath
    CreateObject("WScript.Shell").Run "explorer.exe " & Quote(folderPath), 1, False
End Sub

Private Function HasActiveDocument() As Boolean
    On Error GoTo Fail
    HasActiveDocument = Not (ActiveDocument Is Nothing)
    Exit Function
Fail:
    HasActiveDocument = False
End Function

Private Function SelectionCount() As Long
    On Error GoTo Fail
    SelectionCount = ActiveSelectionRange.Count
    Exit Function
Fail:
    SelectionCount = 0
End Function

Private Function ExportSelectionDXF(ByVal filePath As String) As Boolean
    On Error GoTo TryExportEx
    
    If FileExists(filePath) Then Kill filePath
    ActiveDocument.Export filePath, DXF_FILTER, EXPORT_SELECTION
    ExportSelectionDXF = FileExists(filePath)
    If ExportSelectionDXF Then Exit Function

TryExportEx:
    Err.Clear
    On Error GoTo Fail
    Dim filterObject As Object
    Set filterObject = ActiveDocument.ExportEx(filePath, DXF_FILTER, EXPORT_SELECTION)
    filterObject.Finish
    ExportSelectionDXF = FileExists(filePath)
    Exit Function
Fail:
    ExportSelectionDXF = False
End Function

Private Function ImportResultDXF(ByVal filePath As String) As Boolean
    On Error GoTo Fail
    Dim importObject As Object
    Set importObject = ActiveLayer.ImportEx(filePath, DXF_FILTER)
    importObject.Finish
    ImportResultDXF = True
    Exit Function
Fail:
    ImportResultDXF = False
End Function

Private Sub LaunchSerula(ByVal exePath As String, ByVal inputPath As String, ByVal outputPath As String)
    Dim command As String
    command = Quote(exePath) & _
              " --corel-input " & Quote(inputPath) & _
              " --corel-output " & Quote(outputPath)
    CreateObject("WScript.Shell").Run command, 1, False
End Sub

Private Function CreateBridgePaths(ByRef inputPath As String, ByRef outputPath As String) As Boolean
    On Error GoTo Fail
    Dim sessionFolder As String
    sessionFolder = BridgeRoot() & "\" & SessionId()
    EnsureFolder sessionFolder
    inputPath = sessionFolder & "\corel-selection.dxf"
    outputPath = sessionFolder & "\serula-result.dxf"
    CreateBridgePaths = True
    Exit Function
Fail:
    CreateBridgePaths = False
End Function

Private Function BridgeRoot() As String
    Dim base As String
    base = Environ$("LOCALAPPDATA")
    If Len(base) = 0 Then base = Environ$("TEMP")
    BridgeRoot = base & "\SerulaNesting\CorelBridge"
End Function

Private Function FindSerulaDesktop() As String
    Dim marker As String
    Dim candidate As String
    
    marker = Environ$("LOCALAPPDATA") & "\SerulaNesting\desktop-path.txt"
    candidate = ReadText(marker)
    If FileExists(candidate) Then
        FindSerulaDesktop = candidate
        Exit Function
    End If
    
    candidate = Environ$("LOCALAPPDATA") & "\Programs\Serula Nesting Pro PC\Serula Nesting Pro PC.exe"
    If FileExists(candidate) Then
        FindSerulaDesktop = candidate
        Exit Function
    End If
    
    candidate = Environ$("ProgramFiles") & "\Serula Nesting Pro PC\Serula Nesting Pro PC.exe"
    If FileExists(candidate) Then
        FindSerulaDesktop = candidate
        Exit Function
    End If
    
    candidate = Environ$("ProgramW6432") & "\Serula Nesting Pro PC\Serula Nesting Pro PC.exe"
    If FileExists(candidate) Then
        FindSerulaDesktop = candidate
        Exit Function
    End If
    
    FindSerulaDesktop = ""
End Function

Private Function SessionId() As String
    SessionId = Format$(Now, "yyyymmdd_hhnnss") & "_" & Replace$(CStr(Int(Timer * 100)), ".", "")
End Function

Private Sub EnsureFolder(ByVal folderPath As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FolderExists(folderPath) Then Exit Sub
    Dim parentPath As String
    parentPath = fso.GetParentFolderName(folderPath)
    If Len(parentPath) > 0 And Not fso.FolderExists(parentPath) Then EnsureFolder parentPath
    If Not fso.FolderExists(folderPath) Then fso.CreateFolder folderPath
End Sub

Private Function FileExists(ByVal filePath As String) As Boolean
    On Error GoTo Fail
    If Len(Trim$(filePath)) = 0 Then
        FileExists = False
    Else
        FileExists = (Len(Dir$(filePath, vbNormal Or vbHidden Or vbSystem Or vbReadOnly)) > 0)
    End If
    Exit Function
Fail:
    FileExists = False
End Function

Private Sub WriteText(ByVal filePath As String, ByVal value As String)
    On Error GoTo Fail
    EnsureFolder Left$(filePath, InStrRev(filePath, "\") - 1)
    Dim fso As Object
    Dim stream As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set stream = fso.CreateTextFile(filePath, True, False)
    stream.Write value
    stream.Close
Fail:
End Sub

Private Function ReadText(ByVal filePath As String) As String
    On Error GoTo Fail
    If Not FileExists(filePath) Then Exit Function
    Dim fso As Object
    Dim stream As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set stream = fso.OpenTextFile(filePath, 1, False)
    ReadText = Trim$(stream.ReadAll)
    stream.Close
    Exit Function
Fail:
    ReadText = ""
End Function

Private Function Quote(ByVal value As String) As String
    Quote = Chr$(34) & value & Chr$(34)
End Function
