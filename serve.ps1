$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8083/')
$listener.Start()
$root = 'C:\Users\sameeraw\Downloads\Tender Result'
while ($listener.IsListening) {
  $context = $listener.GetContext()
  $relative = $context.Request.Url.AbsolutePath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
  if ($relative -eq 'api/tenders') {
    try {
      $firebase = Invoke-WebRequest -UseBasicParsing -Uri 'https://tender-reading-management-default-rtdb.firebaseio.com/tenders.json' -TimeoutSec 15
      $bytes = [Text.Encoding]::UTF8.GetBytes($firebase.Content)
      $context.Response.ContentType = 'application/json; charset=utf-8'
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $context.Response.StatusCode = 502
    }
    $context.Response.Close()
    continue
  }
  if ($relative -eq 'basic-report.html') {
    try {
      $firebase = Invoke-WebRequest -UseBasicParsing -Uri 'https://tender-reading-management-default-rtdb.firebaseio.com/tenders.json' -TimeoutSec 15
      $html = [IO.File]::ReadAllText((Join-Path $root $relative))
      $html = $html.Replace('<!--FIREBASE_DATA-->', "<script>window.__FIREBASE_TENDERS__ = $($firebase.Content);</script>")
      $bytes = [Text.Encoding]::UTF8.GetBytes($html)
      $context.Response.ContentType = 'text/html; charset=utf-8'
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $context.Response.StatusCode = 502
    }
    $context.Response.Close()
    continue
  }
  $path = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $context.Response.StatusCode = 404; $context.Response.Close(); continue }
  $extension = [IO.Path]::GetExtension($path)
  $context.Response.ContentType = switch ($extension) { '.html' {'text/html; charset=utf-8'} '.js' {'application/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'} default {'application/octet-stream'} }
  $bytes = [IO.File]::ReadAllBytes($path)
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}
