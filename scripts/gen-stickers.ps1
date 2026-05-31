# 生成一张 256x256 的贴纸精灵表 (Sprite Sheet)
# 分成 2x2 共 4 个 128x128 的格子, 每格一个不同颜色/形状的贴纸
# 用于演示: 完整图片渲染 + 局部裁剪 (frame)
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# --- 左上: 红色爱心圆 ---
$brushRed = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 235, 64, 87))
$g.FillEllipse($brushRed, 16, 16, 96, 96)

# --- 右上: 绿色五角星 ---
$brushGreen = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 76, 175, 80))
$cx = 192.0; $cy = 64.0; $rOuter = 48.0; $rInner = 20.0
$pts = New-Object 'System.Drawing.PointF[]' 10
for ($i = 0; $i -lt 10; $i++) {
    $r = if ($i % 2 -eq 0) { $rOuter } else { $rInner }
    $ang = [Math]::PI / 2 + $i * [Math]::PI / 5
    $px = $cx + $r * [Math]::Cos($ang)
    $py = $cy - $r * [Math]::Sin($ang)
    $pts[$i] = New-Object System.Drawing.PointF($px, $py)
}
$g.FillPolygon($brushGreen, $pts)

# --- 左下: 蓝色圆角方块 ---
$brushBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 33, 150, 243))
$g.FillRectangle($brushBlue, 24, 152, 80, 80)

# --- 右下: 黄色三角形 ---
$brushYellow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 193, 7))
$tri = New-Object 'System.Drawing.PointF[]' 3
$tri[0] = New-Object System.Drawing.PointF(192.0, 144.0)
$tri[1] = New-Object System.Drawing.PointF(240.0, 232.0)
$tri[2] = New-Object System.Drawing.PointF(144.0, 232.0)
$g.FillPolygon($brushYellow, $tri)

# 保存
$outDir = Join-Path $PSScriptRoot "..\public\assets"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outPath = Join-Path $outDir "stickers.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "已生成贴纸图: $outPath"
