Add-Type -AssemblyName System.Drawing

$json = node --input-type=module -e "import { DEFAULT_PORTRAIT_ACCESSORY_ASSETS } from './lib/portrait-accessory-assets.mjs'; console.log(JSON.stringify(DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((a) => a.colors).map(({ id, category, colors }) => ({ id, category, colors }))));"
$assets = $json | ConvertFrom-Json
$classicAssetIds = @(
  'upper-minimal-tee', 'upper-white-shirt', 'upper-tube-top', 'upper-knit-shrug',
  'bottom-straight-trousers', 'bottom-blue-jeans', 'bottom-tailored-trousers', 'bottom-capri-pants',
  'shoes-white-sneakers', 'shoes-skate-sneakers', 'shoes-black-loafers', 'shoes-high-heels'
)
$assets = $assets | Where-Object { $classicAssetIds -contains $_.id }
$outDir = Join-Path (Get-Location) 'public\assets\portrait-accessories'

$colorMap = @{
  'pure-white' = '#f8fafc'; 'pure-black' = '#111827'; 'heather-gray' = '#9ca3af'; 'navy-stripe' = '#f8fafc'
  'sky-blue' = '#93c5fd'; 'cream-stripe' = '#fff7ed'; 'aqua-blue' = '#38bdf8'; 'ribbed-pink' = '#f9a8d4'
  'soft-pink' = '#f4b4bd'; 'oatmeal-knit' = '#d8c3a5'; 'charcoal-melange' = '#374151'; 'charcoal-gray' = '#374151'
  'khaki-twill' = '#c4a484'; 'indigo-blue' = '#1d4ed8'; 'washed-denim' = '#93c5fd'; 'black-denim' = '#1f2937'
  'navy-blue' = '#1e3a8a'; 'oat-check' = '#d8c3a5'; 'khaki' = '#b99b6b'; 'denim-blue' = '#2563eb'
  'silver-gray' = '#d1d5db'; 'green-accent' = '#f8fafc'; 'brown-white' = '#f8fafc'; 'burgundy' = '#7f1d1d'
  'brown-croc' = '#7c4a25'; 'nude-pink' = '#f3c7bd'; 'metallic-silver' = '#d1d5db'
}
$accentMap = @{
  'navy-stripe' = '#1e3a8a'; 'cream-stripe' = '#d6b985'; 'ribbed-pink' = '#db2777'; 'oatmeal-knit' = '#a8845f'
  'charcoal-melange' = '#6b7280'; 'khaki-twill' = '#8b6f47'; 'washed-denim' = '#3b82f6'; 'black-denim' = '#4b5563'
  'oat-check' = '#8b7355'; 'silver-gray' = '#6b7280'; 'green-accent' = '#22c55e'; 'brown-white' = '#8b5e34'
  'brown-croc' = '#b77942'; 'metallic-silver' = '#6b7280'
}

function ColorFromHex([string] $hex) {
  $h = $hex.TrimStart('#')
  [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($h.Substring(0, 2), 16),
    [Convert]::ToInt32($h.Substring(2, 2), 16),
    [Convert]::ToInt32($h.Substring(4, 2), 16)
  )
}

function Darken([System.Drawing.Color] $color) {
  [System.Drawing.Color]::FromArgb(
    [Math]::Max(0, [int]($color.R * 0.62)),
    [Math]::Max(0, [int]($color.G * 0.62)),
    [Math]::Max(0, [int]($color.B * 0.62))
  )
}

function Add-Polygon($graphics, $points, $brush, $pen) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddPolygon($points)
  $graphics.FillPath($brush, $path)
  $graphics.DrawPath($pen, $path)
  $path.Dispose()
}

function Add-Texture($graphics, [string] $colorId, [System.Drawing.Color] $accent) {
  if ($colorId -notmatch 'stripe|check|denim|knit|melange|twill|ribbed|croc|silver|accent|brown-white') {
    return
  }
  $pen = New-Object System.Drawing.Pen($accent, 2)
  for ($i = 90; $i -lt 390; $i += 24) {
    $graphics.DrawLine($pen, $i, 95, $i + 45, 370)
  }
  $pen.Dispose()
}

function Draw-Upper($graphics, $asset, $brush, $pen) {
  if ($asset.id -eq 'upper-tube-top') {
    $graphics.FillRectangle($brush, 130, 150, 220, 170)
    $graphics.DrawRectangle($pen, 130, 150, 220, 170)
  } elseif ($asset.id -eq 'upper-knit-shrug') {
    Add-Polygon $graphics @(
      [System.Drawing.Point]::new(170, 140), [System.Drawing.Point]::new(106, 170),
      [System.Drawing.Point]::new(112, 355), [System.Drawing.Point]::new(165, 360),
      [System.Drawing.Point]::new(200, 225), [System.Drawing.Point]::new(280, 225),
      [System.Drawing.Point]::new(315, 360), [System.Drawing.Point]::new(368, 355),
      [System.Drawing.Point]::new(374, 170), [System.Drawing.Point]::new(310, 140)
    ) $brush $pen
  } elseif ($asset.id -eq 'upper-white-shirt') {
    Add-Polygon $graphics @(
      [System.Drawing.Point]::new(175, 112), [System.Drawing.Point]::new(305, 112),
      [System.Drawing.Point]::new(370, 160), [System.Drawing.Point]::new(350, 356),
      [System.Drawing.Point]::new(308, 345), [System.Drawing.Point]::new(300, 370),
      [System.Drawing.Point]::new(180, 370), [System.Drawing.Point]::new(172, 345),
      [System.Drawing.Point]::new(130, 356), [System.Drawing.Point]::new(110, 160)
    ) $brush $pen
    $graphics.DrawLine($pen, 240, 125, 240, 360)
    for ($y = 160; $y -lt 330; $y += 34) {
      $graphics.DrawEllipse($pen, 235, $y, 10, 10)
    }
  } else {
    Add-Polygon $graphics @(
      [System.Drawing.Point]::new(158, 122), [System.Drawing.Point]::new(118, 176),
      [System.Drawing.Point]::new(168, 206), [System.Drawing.Point]::new(180, 356),
      [System.Drawing.Point]::new(300, 356), [System.Drawing.Point]::new(312, 206),
      [System.Drawing.Point]::new(362, 176), [System.Drawing.Point]::new(322, 122)
    ) $brush $pen
    $graphics.DrawArc($pen, 202, 118, 76, 52, 0, 180)
  }
}

function Draw-Bottom($graphics, $asset, $brush, $pen) {
  $hem = 378
  if ($asset.id -eq 'bottom-capri-pants') {
    $hem = 326
  }
  $graphics.FillRectangle($brush, 156, 94, 168, 42)
  $graphics.DrawRectangle($pen, 156, 94, 168, 42)
  Add-Polygon $graphics @(
    [System.Drawing.Point]::new(164, 134), [System.Drawing.Point]::new(232, 134),
    [System.Drawing.Point]::new(226, $hem), [System.Drawing.Point]::new(176, $hem)
  ) $brush $pen
  Add-Polygon $graphics @(
    [System.Drawing.Point]::new(248, 134), [System.Drawing.Point]::new(316, 134),
    [System.Drawing.Point]::new(304, $hem), [System.Drawing.Point]::new(254, $hem)
  ) $brush $pen
  $graphics.DrawLine($pen, 240, 140, 240, $hem)
}

function Draw-Shoes($graphics, $asset, $brush, $pen) {
  foreach ($x in @(86, 228)) {
    if ($asset.id -eq 'shoes-high-heels') {
      Add-Polygon $graphics @(
        [System.Drawing.Point]::new($x + 45, 250), [System.Drawing.Point]::new($x + 140, 220),
        [System.Drawing.Point]::new($x + 180, 272), [System.Drawing.Point]::new($x + 105, 295),
        [System.Drawing.Point]::new($x + 50, 286)
      ) $brush $pen
      $graphics.DrawLine($pen, $x + 165, 280, $x + 185, 355)
    } elseif ($asset.id -eq 'shoes-black-loafers') {
      $graphics.FillPie($brush, $x + 15, 210, 180, 92, 180, 180)
      $graphics.DrawArc($pen, $x + 15, 210, 180, 92, 180, 180)
      $graphics.FillRectangle([System.Drawing.Brushes]::WhiteSmoke, $x + 25, 288, 150, 13)
    } else {
      Add-Polygon $graphics @(
        [System.Drawing.Point]::new($x + 18, 246), [System.Drawing.Point]::new($x + 76, 210),
        [System.Drawing.Point]::new($x + 174, 246), [System.Drawing.Point]::new($x + 200, 284),
        [System.Drawing.Point]::new($x + 32, 292)
      ) $brush $pen
      $graphics.FillRectangle([System.Drawing.Brushes]::WhiteSmoke, $x + 44, 288, 162, 16)
    }
  }
}

foreach ($asset in $assets) {
  foreach ($color in $asset.colors) {
    $baseHex = if ($colorMap.ContainsKey($color.id)) { $colorMap[$color.id] } else { '#e5e7eb' }
    $accentHex = if ($accentMap.ContainsKey($color.id)) { $accentMap[$color.id] } else { '#64748b' }
    $base = ColorFromHex $baseHex
    $accent = ColorFromHex $accentHex
    $bitmap = New-Object System.Drawing.Bitmap(480, 480)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(248, 250, 252))
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 0, 0, 0))
    $graphics.FillEllipse($shadow, 115, 382, 250, 28)
    $shadow.Dispose()
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      [System.Drawing.Rectangle]::new(80, 80, 320, 310),
      [System.Drawing.Color]::White,
      $base,
      90
    )
    $pen = New-Object System.Drawing.Pen((Darken $base), 3)
    if ($asset.category -eq 'upper') {
      Draw-Upper $graphics $asset $brush $pen
    } elseif ($asset.category -eq 'bottom') {
      Draw-Bottom $graphics $asset $brush $pen
    } else {
      Draw-Shoes $graphics $asset $brush $pen
    }
    Add-Texture $graphics $color.id $accent
    $brush.Dispose()
    $pen.Dispose()
    $file = Join-Path $outDir ([IO.Path]::GetFileName($color.src))
    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    if ($color.id -eq 'pure-white' -or -not (Test-Path (Join-Path $outDir "$($asset.id).png"))) {
      $bitmap.Save((Join-Path $outDir "$($asset.id).png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Write-Output "Generated $($assets.Count) classic asset sets"
