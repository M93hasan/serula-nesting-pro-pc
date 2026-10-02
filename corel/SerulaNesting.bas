Attribute VB_Name = "SerulaNesting"
Option Explicit

' ============================================================
' Serula Nesting for CorelDRAW - Offline / Corel-only edition
' Version 0.2.0
'
' No internet, no browser, no external EXE and no WinAPI calls.
' Each selected top-level CorelDRAW object is treated as one part.
' Group a part with its holes/details before running the macro.
' ============================================================

Private Const APP_NAME As String = "SerulaNesting"
Private Const APP_SECTION As String = "Corel"
Private Const VERSION_TEXT As String = "0.2.0"

Private Type TPlacement
    X As Double
    Y As Double
    W As Double
    H As Double
    Angle As Double
    Found As Boolean
End Type

Public Sub Serula_Nesting()
    Dim doc As Document
    Dim selected As ShapeRange
    Dim parts() As Shape
    Dim widths() As Double
    Dim heights() As Double
    Dim areas() As Double
    Dim count As Long
    Dim s As Shape
    Dim i As Long
    
    If ActiveDocument Is Nothing Then
        MsgBox "Acik bir CorelDRAW belgesi bulunamadi.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    Set doc = ActiveDocument
    Set selected = ActiveSelectionRange
    
    If selected.Count = 0 Then
        MsgBox "Nesting yapilacak parcalari secin." & vbCrLf & _
               "Her ust nesne bir parca kabul edilir. Ic cizgileri/delikleri parca ile gruplayin.", _
               vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    
    If Not EnsureSettings() Then Exit Sub
    
    Dim materialType As String
    Dim materialWidth As Double
    Dim sheetLength As Double
    Dim spacing As Double
    Dim margin As Double
    Dim rotationMode As String
    Dim startCorner As String
    
    materialType = UCase$(GetSetting(APP_NAME, APP_SECTION, "MaterialType", "R"))
    materialWidth = Val(GetSetting(APP_NAME, APP_SECTION, "MaterialWidth", "1400"))
    sheetLength = Val(GetSetting(APP_NAME, APP_SECTION, "SheetLength", "1000"))
    spacing = Val(GetSetting(APP_NAME, APP_SECTION, "Spacing", "0.3"))
    margin = Val(GetSetting(APP_NAME, APP_SECTION, "Margin", "5"))
    rotationMode = UCase$(GetSetting(APP_NAME, APP_SECTION, "RotationMode", "90"))
    startCorner = UCase$(GetSetting(APP_NAME, APP_SECTION, "StartCorner", "RB"))
    
    If materialWidth <= 0 Or spacing < 0 Or margin < 0 Then
        MsgBox "Serula ayarlari gecersiz. Serula_Ayarlar makrosunu calistirin.", vbCritical, "Serula Nesting"
        Exit Sub
    End If
    If materialType = "P" And sheetLength <= 0 Then
        MsgBox "Plaka uzunlugu gecersiz. Serula_Ayarlar makrosunu calistirin.", vbCritical, "Serula Nesting"
        Exit Sub
    End If
    
    count = selected.Count
    ReDim parts(1 To count)
    ReDim widths(1 To count)
    ReDim heights(1 To count)
    ReDim areas(1 To count)
    
    Dim originalUnit As Long
    originalUnit = doc.Unit
    
    On Error GoTo Failed
    doc.Unit = cdrMillimeter
    
    i = 0
    For Each s In selected
        i = i + 1
        Set parts(i) = s
        widths(i) = s.SizeWidth
        heights(i) = s.SizeHeight
        areas(i) = widths(i) * heights(i)
    Next s
    
    SortPartsByArea parts, widths, heights, areas, count
    
    On Error Resume Next
    doc.BeginCommandGroup "Serula Nesting"
    On Error GoTo Failed
    
    Dim pageNo As Long
    Dim outPage As Page
    Dim outLayer As Layer
    Dim placedShapes As Collection
    Dim px() As Double, py() As Double, pw() As Double, ph() As Double
    Dim placedCount As Long
    Dim maxPlacedTop As Double
    Dim pageHeight As Double
    
    pageNo = 1
    pageHeight = InitialPageHeight(materialType, sheetLength, heights, widths, count, margin, spacing)
    CreateOutputPage doc, materialWidth, pageHeight, pageNo, outPage, outLayer
    Set placedShapes = New Collection
    ResetPlaced px, py, pw, ph, placedCount
    maxPlacedTop = margin
    
    Dim p As TPlacement
    Dim dup As Shape
    Dim allowedHeight As Double
    
    For i = 1 To count
RetryPart:
        If materialType = "P" Then
            allowedHeight = sheetLength
        Else
            allowedHeight = pageHeight
        End If
        
        p = FindBestPlacement(widths(i), heights(i), materialWidth, allowedHeight, _
                              spacing, margin, rotationMode, px, py, pw, ph, placedCount)
        
        If Not p.Found Then
            If placedCount = 0 Then
                MsgBox "Parca " & CStr(i) & " malzeme olcusune sigmiyor." & vbCrLf & _
                       "Parca: " & Format$(widths(i), "0.###") & " x " & Format$(heights(i), "0.###") & " mm" & vbCrLf & _
                       "Malzeme genisligi: " & Format$(materialWidth, "0.###") & " mm", _
                       vbCritical, "Serula Nesting"
                GoTo Failed
            End If
            
            FinalizeOutputPage outPage, outLayer, placedShapes, materialWidth, _
                               IIf(materialType = "P", sheetLength, maxPlacedTop + margin), _
                               startCorner, materialType
            
            If materialType = "R" Then
                MsgBox "Rulo modunda beklenmeyen yerlesim siniri olustu.", vbCritical, "Serula Nesting"
                GoTo Failed
            End If
            
            pageNo = pageNo + 1
            CreateOutputPage doc, materialWidth, sheetLength, pageNo, outPage, outLayer
            Set placedShapes = New Collection
            ResetPlaced px, py, pw, ph, placedCount
            maxPlacedTop = margin
            GoTo RetryPart
        End If
        
        Set dup = parts(i).Duplicate
        dup.MoveToLayer outLayer
        
        If Abs(p.Angle) > 0.000001 Then dup.Rotate p.Angle
        
        doc.ReferencePoint = cdrBottomLeft
        dup.PositionX = p.X
        dup.PositionY = p.Y
        
        placedShapes.Add dup
        AddPlacedRect px, py, pw, ph, placedCount, p.X, p.Y, p.W, p.H
        If p.Y + p.H > maxPlacedTop Then maxPlacedTop = p.Y + p.H
    Next i
    
    FinalizeOutputPage outPage, outLayer, placedShapes, materialWidth, _
                       IIf(materialType = "P", sheetLength, maxPlacedTop + margin), _
                       startCorner, materialType
    
    doc.Unit = originalUnit
    On Error Resume Next
    doc.EndCommandGroup
    On Error GoTo 0
    
    MsgBox "Serula Nesting tamamlandi." & vbCrLf & _
           CStr(count) & " parca yerlestirildi." & vbCrLf & _
           IIf(pageNo > 1, CStr(pageNo) & " plaka/sayfa olusturuldu.", "1 nesting sayfasi olusturuldu.") & vbCrLf & vbCrLf & _
           "Surum " & VERSION_TEXT, vbInformation, "Serula Nesting"
    Exit Sub

Failed:
    On Error Resume Next
    doc.Unit = originalUnit
    doc.EndCommandGroup
    On Error GoTo 0
    MsgBox "Serula Nesting durdu: " & Err.Description, vbCritical, "Serula Nesting"
End Sub

Public Sub Serula_Ayarlar()
    Dim v As String
    
    v = InputBox("Malzeme tipi:" & vbCrLf & _
                 "R = Rulo" & vbCrLf & _
                 "P = Plaka", _
                 "Serula - Malzeme Tipi", GetSetting(APP_NAME, APP_SECTION, "MaterialType", "R"))
    If Len(v) = 0 Then Exit Sub
    v = UCase$(Trim$(v))
    If v <> "R" And v <> "P" Then
        MsgBox "Sadece R veya P girin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "MaterialType", v
    
    v = InputBox("Malzeme genisligi (mm):", "Serula - Genislik", _
                 GetSetting(APP_NAME, APP_SECTION, "MaterialWidth", "1400"))
    If Len(v) = 0 Then Exit Sub
    If Val(v) <= 0 Then
        MsgBox "Gecerli bir genislik girin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "MaterialWidth", NormalizeNumber(v)
    
    If UCase$(GetSetting(APP_NAME, APP_SECTION, "MaterialType", "R")) = "P" Then
        v = InputBox("Plaka uzunlugu (mm):", "Serula - Plaka Uzunlugu", _
                     GetSetting(APP_NAME, APP_SECTION, "SheetLength", "1000"))
        If Len(v) = 0 Then Exit Sub
        If Val(v) <= 0 Then
            MsgBox "Gecerli bir plaka uzunlugu girin.", vbExclamation, "Serula Nesting"
            Exit Sub
        End If
        SaveSetting APP_NAME, APP_SECTION, "SheetLength", NormalizeNumber(v)
    End If
    
    v = InputBox("Parca araligi (mm):", "Serula - Parca Araligi", _
                 GetSetting(APP_NAME, APP_SECTION, "Spacing", "0.3"))
    If Len(v) = 0 Then Exit Sub
    If Val(v) < 0 Then
        MsgBox "Parca araligi negatif olamaz.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "Spacing", NormalizeNumber(v)
    
    v = InputBox("Kenar boslugu / margin (mm):", "Serula - Margin", _
                 GetSetting(APP_NAME, APP_SECTION, "Margin", "5"))
    If Len(v) = 0 Then Exit Sub
    If Val(v) < 0 Then
        MsgBox "Margin negatif olamaz.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "Margin", NormalizeNumber(v)
    
    v = InputBox("Donus modu:" & vbCrLf & _
                 "0 = Donus yok" & vbCrLf & _
                 "90 = 0 / 90 derece" & vbCrLf & _
                 "ANY = serbest mod (bu surumde 0/90 adaylari)", _
                 "Serula - Donus", GetSetting(APP_NAME, APP_SECTION, "RotationMode", "90"))
    If Len(v) = 0 Then Exit Sub
    v = UCase$(Trim$(v))
    If v <> "0" And v <> "90" And v <> "ANY" Then
        MsgBox "0, 90 veya ANY girin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "RotationMode", v
    
    v = InputBox("Baslangic kosesi:" & vbCrLf & _
                 "LB = Sol alt" & vbCrLf & _
                 "RB = Sag alt" & vbCrLf & _
                 "LT = Sol ust" & vbCrLf & _
                 "RT = Sag ust", _
                 "Serula - Baslangic", GetSetting(APP_NAME, APP_SECTION, "StartCorner", "RB"))
    If Len(v) = 0 Then Exit Sub
    v = UCase$(Trim$(v))
    If v <> "LB" And v <> "RB" And v <> "LT" And v <> "RT" Then
        MsgBox "LB, RB, LT veya RT girin.", vbExclamation, "Serula Nesting"
        Exit Sub
    End If
    SaveSetting APP_NAME, APP_SECTION, "StartCorner", v
    
    MsgBox "Serula ayarlari kaydedildi.", vbInformation, "Serula Nesting"
End Sub

Public Sub Serula_Bilgi()
    MsgBox "Serula Nesting for CorelDRAW" & vbCrLf & _
           "Surum " & VERSION_TEXT & vbCrLf & vbCrLf & _
           "Tamamen CorelDRAW icinde ve internetsiz calisir." & vbCrLf & _
           "Secili her ust nesne bir parca kabul edilir.", _
           vbInformation, "Serula Nesting"
End Sub

Private Function EnsureSettings() As Boolean
    If Len(GetSetting(APP_NAME, APP_SECTION, "Configured", "")) = 0 Then
        Serula_Ayarlar
        If Len(GetSetting(APP_NAME, APP_SECTION, "MaterialWidth", "")) = 0 Then
            EnsureSettings = False
            Exit Function
        End If
        SaveSetting APP_NAME, APP_SECTION, "Configured", "1"
    End If
    EnsureSettings = True
End Function

Private Function NormalizeNumber(ByVal text As String) As String
    NormalizeNumber = Replace$(Trim$(text), ",", ".")
End Function

Private Sub SortPartsByArea(ByRef parts() As Shape, ByRef widths() As Double, _
                            ByRef heights() As Double, ByRef areas() As Double, ByVal count As Long)
    Dim i As Long, j As Long
    Dim ts As Shape
    Dim td As Double
    
    For i = 1 To count - 1
        For j = i + 1 To count
            If areas(j) > areas(i) Then
                Set ts = parts(i)
                Set parts(i) = parts(j)
                Set parts(j) = ts
                
                td = widths(i): widths(i) = widths(j): widths(j) = td
                td = heights(i): heights(i) = heights(j): heights(j) = td
                td = areas(i): areas(i) = areas(j): areas(j) = td
            End If
        Next j
    Next i
End Sub

Private Function InitialPageHeight(ByVal materialType As String, ByVal sheetLength As Double, _
                                   ByRef heights() As Double, ByRef widths() As Double, _
                                   ByVal count As Long, ByVal margin As Double, ByVal spacing As Double) As Double
    If materialType = "P" Then
        InitialPageHeight = sheetLength
        Exit Function
    End If
    
    Dim total As Double
    Dim i As Long
    total = margin * 2
    For i = 1 To count
        If heights(i) > widths(i) Then
            total = total + heights(i) + spacing
        Else
            total = total + widths(i) + spacing
        End If
    Next i
    
    If total < 100 Then total = 100
    InitialPageHeight = total
End Function

Private Sub CreateOutputPage(ByVal doc As Document, ByVal widthMm As Double, ByVal heightMm As Double, _
                             ByVal pageNo As Long, ByRef outPage As Page, ByRef outLayer As Layer)
    Set outPage = doc.AddPages(1)
    outPage.Activate
    outPage.SetSize widthMm, heightMm
    Set outLayer = outPage.ActiveLayer
    
    On Error Resume Next
    outLayer.Name = "SERULA NESTING " & CStr(pageNo)
    On Error GoTo 0
End Sub

Private Sub ResetPlaced(ByRef px() As Double, ByRef py() As Double, _
                        ByRef pw() As Double, ByRef ph() As Double, ByRef placedCount As Long)
    placedCount = 0
    ReDim px(1 To 1)
    ReDim py(1 To 1)
    ReDim pw(1 To 1)
    ReDim ph(1 To 1)
End Sub

Private Sub AddPlacedRect(ByRef px() As Double, ByRef py() As Double, _
                          ByRef pw() As Double, ByRef ph() As Double, ByRef placedCount As Long, _
                          ByVal x As Double, ByVal y As Double, ByVal w As Double, ByVal h As Double)
    placedCount = placedCount + 1
    ReDim Preserve px(1 To placedCount)
    ReDim Preserve py(1 To placedCount)
    ReDim Preserve pw(1 To placedCount)
    ReDim Preserve ph(1 To placedCount)
    px(placedCount) = x
    py(placedCount) = y
    pw(placedCount) = w
    ph(placedCount) = h
End Sub

Private Function FindBestPlacement(ByVal originalW As Double, ByVal originalH As Double, _
                                   ByVal materialW As Double, ByVal materialH As Double, _
                                   ByVal spacing As Double, ByVal margin As Double, _
                                   ByVal rotationMode As String, _
                                   ByRef px() As Double, ByRef py() As Double, _
                                   ByRef pw() As Double, ByRef ph() As Double, _
                                   ByVal placedCount As Long) As TPlacement
    Dim best As TPlacement
    Dim attempt As Long
    Dim attempts As Long
    Dim w As Double, h As Double, angle As Double
    Dim candidate As TPlacement
    
    attempts = 1
    If rotationMode = "90" Or rotationMode = "ANY" Then attempts = 2
    
    For attempt = 1 To attempts
        If attempt = 1 Then
            w = originalW
            h = originalH
            angle = 0
        Else
            w = originalH
            h = originalW
            angle = 90
        End If
        
        candidate = FindBestPositionForSize(w, h, materialW, materialH, spacing, margin, _
                                            px, py, pw, ph, placedCount)
        If candidate.Found Then
            candidate.Angle = angle
            If Not best.Found Then
                best = candidate
            ElseIf IsPlacementBetter(candidate, best) Then
                best = candidate
            End If
        End If
    Next attempt
    
    FindBestPlacement = best
End Function

Private Function FindBestPositionForSize(ByVal w As Double, ByVal h As Double, _
                                         ByVal materialW As Double, ByVal materialH As Double, _
                                         ByVal spacing As Double, ByVal margin As Double, _
                                         ByRef px() As Double, ByRef py() As Double, _
                                         ByRef pw() As Double, ByRef ph() As Double, _
                                         ByVal placedCount As Long) As TPlacement
    Dim result As TPlacement
    Dim xs() As Double, ys() As Double
    Dim xCount As Long, yCount As Long
    Dim i As Long, j As Long
    Dim x As Double, y As Double
    
    If w + margin * 2 > materialW Or h + margin * 2 > materialH Then
        FindBestPositionForSize = result
        Exit Function
    End If
    
    BuildCandidates xs, xCount, True, margin, spacing, px, py, pw, ph, placedCount
    BuildCandidates ys, yCount, False, margin, spacing, px, py, pw, ph, placedCount
    
    For j = 1 To yCount
        y = ys(j)
        If y + h > materialH - margin + 0.000001 Then GoTo NextY
        
        For i = 1 To xCount
            x = xs(i)
            If x + w > materialW - margin + 0.000001 Then GoTo NextX
            
            If RectFits(x, y, w, h, spacing, px, py, pw, ph, placedCount) Then
                Dim p As TPlacement
                p.X = x
                p.Y = y
                p.W = w
                p.H = h
                p.Found = True
                
                If Not result.Found Then
                    result = p
                ElseIf IsPlacementBetter(p, result) Then
                    result = p
                End If
            End If
NextX:
        Next i
NextY:
    Next j
    
    FindBestPositionForSize = result
End Function

Private Sub BuildCandidates(ByRef values() As Double, ByRef valueCount As Long, _
                            ByVal horizontal As Boolean, ByVal margin As Double, ByVal spacing As Double, _
                            ByRef px() As Double, ByRef py() As Double, _
                            ByRef pw() As Double, ByRef ph() As Double, ByVal placedCount As Long)
    Dim i As Long
    valueCount = 1
    ReDim values(1 To placedCount + 1)
    values(1) = margin
    
    For i = 1 To placedCount
        valueCount = valueCount + 1
        If horizontal Then
            values(valueCount) = px(i) + pw(i) + spacing
        Else
            values(valueCount) = py(i) + ph(i) + spacing
        End If
    Next i
    
    SortDoubles values, valueCount
End Sub

Private Sub SortDoubles(ByRef values() As Double, ByVal count As Long)
    Dim i As Long, j As Long
    Dim t As Double
    For i = 1 To count - 1
        For j = i + 1 To count
            If values(j) < values(i) Then
                t = values(i)
                values(i) = values(j)
                values(j) = t
            End If
        Next j
    Next i
End Sub

Private Function RectFits(ByVal x As Double, ByVal y As Double, ByVal w As Double, ByVal h As Double, _
                          ByVal spacing As Double, _
                          ByRef px() As Double, ByRef py() As Double, _
                          ByRef pw() As Double, ByRef ph() As Double, ByVal placedCount As Long) As Boolean
    Dim i As Long
    For i = 1 To placedCount
        If Not (x + w + spacing <= px(i) + 0.000001 Or _
                x >= px(i) + pw(i) + spacing - 0.000001 Or _
                y + h + spacing <= py(i) + 0.000001 Or _
                y >= py(i) + ph(i) + spacing - 0.000001) Then
            RectFits = False
            Exit Function
        End If
    Next i
    RectFits = True
End Function

Private Function IsPlacementBetter(ByRef a As TPlacement, ByRef b As TPlacement) As Boolean
    Dim topA As Double, topB As Double
    topA = a.Y + a.H
    topB = b.Y + b.H
    
    If topA < topB - 0.000001 Then
        IsPlacementBetter = True
    ElseIf Abs(topA - topB) <= 0.000001 Then
        If a.Y < b.Y - 0.000001 Then
            IsPlacementBetter = True
        ElseIf Abs(a.Y - b.Y) <= 0.000001 And a.X < b.X - 0.000001 Then
            IsPlacementBetter = True
        End If
    End If
End Function

Private Sub FinalizeOutputPage(ByVal outPage As Page, ByVal outLayer As Layer, _
                               ByVal placedShapes As Collection, ByVal materialWidth As Double, _
                               ByVal finalHeight As Double, ByVal startCorner As String, _
                               ByVal materialType As String)
    Dim s As Shape
    Dim i As Long
    Dim rightSide As Boolean
    Dim topSide As Boolean
    
    If finalHeight < 10 Then finalHeight = 10
    
    outPage.Activate
    If materialType = "R" Then outPage.SetSize materialWidth, finalHeight
    
    ActiveDocument.ReferencePoint = cdrBottomLeft
    
    rightSide = (startCorner = "RB" Or startCorner = "RT")
    topSide = (startCorner = "LT" Or startCorner = "RT")
    
    For i = 1 To placedShapes.Count
        Set s = placedShapes(i)
        If rightSide Then s.PositionX = materialWidth - s.PositionX - s.SizeWidth
        If topSide Then s.PositionY = finalHeight - s.PositionY - s.SizeHeight
    Next i
End Sub
