Add-Type -AssemblyName System.Drawing

function New-Placeholder {
    param(
        [string]$Path,
        [int]$Width,
        [int]$Height,
        [string]$Label,
        [string]$BgHex,
        [string]$FgHex = "#FFFFFF"
    )

    $bg = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
    $fg = [System.Drawing.ColorTranslator]::FromHtml($FgHex)

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bgDarkR = [Math]::Max(0, [int]$bg.R - 35)
    $bgDarkG = [Math]::Max(0, [int]$bg.G - 35)
    $bgDarkB = [Math]::Max(0, [int]$bg.B - 35)
    $bgDark = [System.Drawing.Color]::FromArgb(255, $bgDarkR, $bgDarkG, $bgDarkB)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bg, $bgDark, 45.0)
    $g.FillRectangle($brush, $rect)

    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60,255,255,255), 3)
    $g.DrawRectangle($borderPen, 2, 2, ($Width-5), ($Height-5))

    # decorative circle
    $circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40,255,255,255))
    $circleSize = [Math]::Min($Width, $Height) * 0.55
    $cx = ($Width - $circleSize) / 2
    $cy = ($Height * 0.42) - ($circleSize / 2)
    $g.FillEllipse($circleBrush, [float]$cx, [float]$cy, [float]$circleSize, [float]$circleSize)

    $fgBrush = New-Object System.Drawing.SolidBrush($fg)

    $fontSize = [Math]::Max(12, [Math]::Min(22, ($Width / 12)))
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF(10.0, ([float]($Height*0.55)), ([float]($Width-20)), ([float]($Height*0.4)))
    $g.DrawString($Label, $font, $fgBrush, $textRect, $format)

    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $Path"
}

$imgDir = "F:\FINAL M2 PROJ\edu-wallet(implementation)\web\edumart\public\images"
$blue = "#2E5FAC"
$green = "#16A34A"
$red = "#DC2626"

New-Placeholder -Path "$imgDir\logo.png" -Width 200 -Height 200 -Label "EduMart" -BgHex $blue
New-Placeholder -Path "$imgDir\category-tuition.png" -Width 400 -Height 300 -Label "Tuition" -BgHex $blue
New-Placeholder -Path "$imgDir\category-rent.png" -Width 400 -Height 300 -Label "Rent" -BgHex $blue
New-Placeholder -Path "$imgDir\category-personal.png" -Width 400 -Height 300 -Label "Personal" -BgHex $blue
New-Placeholder -Path "$imgDir\product-python-course.png" -Width 300 -Height 300 -Label "Python Course" -BgHex $blue
New-Placeholder -Path "$imgDir\product-campus-lunch.png" -Width 300 -Height 300 -Label "Campus Lunch" -BgHex $blue
New-Placeholder -Path "$imgDir\product-github-pro.png" -Width 300 -Height 300 -Label "GitHub Pro" -BgHex $blue
New-Placeholder -Path "$imgDir\product-bus-pass.png" -Width 300 -Height 300 -Label "Bus Pass" -BgHex $blue
New-Placeholder -Path "$imgDir\product-semester-fee.png" -Width 300 -Height 300 -Label "Semester Fee" -BgHex $blue
New-Placeholder -Path "$imgDir\product-apartment-rent.png" -Width 300 -Height 300 -Label "Apartment Rent" -BgHex $blue
New-Placeholder -Path "$imgDir\payment-success.png" -Width 400 -Height 300 -Label "Payment Approved" -BgHex $green
New-Placeholder -Path "$imgDir\payment-failed.png" -Width 400 -Height 300 -Label "Payment Failed" -BgHex $red

Write-Host "All placeholders generated."
