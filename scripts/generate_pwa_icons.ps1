Add-Type -AssemblyName System.Drawing

function Generate-Icon($size, $outputPath, $isMaskable = $false) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $scale = $size / 512.0

    # Fill background
    $bgColor = [System.Drawing.Color]::FromArgb(15, 23, 42) # Slate 900
    if ($isMaskable) {
        $g.Clear($bgColor)
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.PointF 0, 0),
            (New-Object System.Drawing.PointF $size, $size),
            [System.Drawing.Color]::FromArgb(15, 23, 42),
            [System.Drawing.Color]::FromArgb(2, 6, 23)
        )
        $radius = 112.0 * $scale
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $rect = New-Object System.Drawing.RectangleF 4, 4, ($size - 8), ($size - 8)
        $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
        $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
        $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
        $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)

        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(51, 65, 85), (4 * $scale))
        $g.DrawPath($borderPen, $path)
    }

    # Center Ambient Ring
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 239, 68, 68), (3 * $scale))
    $ringSize = 340.0 * $scale
    $ringOffset = ($size - $ringSize) / 2.0
    $g.DrawEllipse($ringPen, $ringOffset, $ringOffset, $ringSize, $ringSize)

    # Stylized Play Triangle
    $triangleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF ($size * 0.35), ($size * 0.25)),
        (New-Object System.Drawing.PointF ($size * 0.75), ($size * 0.75)),
        [System.Drawing.Color]::FromArgb(90, 6, 182, 212),
        [System.Drawing.Color]::FromArgb(90, 59, 130, 246)
    )
    $p1 = New-Object System.Drawing.PointF (210.0 * $scale), (150.0 * $scale)
    $p2 = New-Object System.Drawing.PointF (360.0 * $scale), (256.0 * $scale)
    $p3 = New-Object System.Drawing.PointF (210.0 * $scale), (362.0 * $scale)
    $g.FillPolygon($triangleBrush, @($p1, $p2, $p3))

    # Download Arrow Shape
    $arrowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF 0, ($size * 0.25)),
        (New-Object System.Drawing.PointF 0, ($size * 0.7)),
        [System.Drawing.Color]::FromArgb(239, 68, 68),
        [System.Drawing.Color]::FromArgb(244, 63, 94)
    )

    $arrowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pts = @(
        (New-Object System.Drawing.PointF (226.0 * $scale), (130.0 * $scale)),
        (New-Object System.Drawing.PointF (286.0 * $scale), (130.0 * $scale)),
        (New-Object System.Drawing.PointF (286.0 * $scale), (240.0 * $scale)),
        (New-Object System.Drawing.PointF (350.0 * $scale), (240.0 * $scale)),
        (New-Object System.Drawing.PointF (256.0 * $scale), (350.0 * $scale)),
        (New-Object System.Drawing.PointF (162.0 * $scale), (240.0 * $scale)),
        (New-Object System.Drawing.PointF (226.0 * $scale), (240.0 * $scale))
    )
    $arrowPath.AddPolygon($pts)
    $g.FillPath($arrowBrush, $arrowPath)

    # Bottom Tray / Bar
    $trayBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF ($size * 0.3), ($size * 0.74)),
        (New-Object System.Drawing.PointF ($size * 0.7), ($size * 0.78)),
        [System.Drawing.Color]::FromArgb(6, 182, 212),
        [System.Drawing.Color]::FromArgb(59, 130, 246)
    )
    $trayX = 156.0 * $scale
    $trayY = 380.0 * $scale
    $trayW = 200.0 * $scale
    $trayH = 24.0 * $scale
    $trayPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $trayR = $trayH / 2.0
    $trayPath.AddArc($trayX, $trayY, $trayH, $trayH, 90, 180)
    $trayPath.AddArc($trayX + $trayW - $trayH, $trayY, $trayH, $trayH, 270, 180)
    $trayPath.CloseFigure()
    $g.FillPath($trayBrush, $trayPath)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $outputPath"
}

$publicDir = Join-Path $PSScriptRoot "..\public"
Generate-Icon 192 (Join-Path $publicDir "pwa-192x192.png") $false
Generate-Icon 512 (Join-Path $publicDir "pwa-512x512.png") $false
Generate-Icon 512 (Join-Path $publicDir "pwa-maskable-512x512.png") $true
Write-Host "PWA icons successfully generated!"
