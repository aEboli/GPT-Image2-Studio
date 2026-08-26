using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace GPTImage2Studio.ProductImageClipboardHost
{
    internal static class Program
    {
        private const string HostName = "com.aeboli.gpt_image2_studio.product_image_clipboard";
        private const int MaxRequestBytes = 4 * 1024 * 1024;
        private const int MaxResponseBytes = 1024 * 1024;
        private const int MaxItemCount = 1000;
        private const int MaxConcurrency = 10;
        private const int MaxRedirects = 5;
        private const long MaxImageBytes = 20L * 1024 * 1024;
        private const long MaxBatchBytes = 512L * 1024 * 1024;
        private const int ClipboardCannotOpenError = unchecked((int)0x800401D0);

        private static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer
        {
            MaxJsonLength = MaxRequestBytes
        };
        private static readonly string[] Categories = { "main", "detail", "sku" };
        private static readonly string[] AmazonHosts =
        {
            "amazon.com", "amazon.ca", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
            "amazon.es", "amazon.co.jp", "amazon.com.au", "amazon.com.mx", "amazon.in"
        };
        private static readonly Dictionary<string, string[]> ImageHostSuffixes =
            new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                { "1688", new[] { "alicdn.com", "1688.com" } },
                { "amazon", new[] { "media-amazon.com", "ssl-images-amazon.com" } },
                { "temu", new[] { "kwcdn.com" } },
                { "tiktok", new[] { "tiktokcdn.com", "tiktokcdn-us.com", "ttcdn-us.com", "ibyteimg.com", "byteimg.com" } },
                { "shein", new[] { "ltwebstatic.com", "shein.com" } },
                { "gigacloud", new[] { "gigab2b.com", "gigab2b.cn" } }
            };
        private static readonly Dictionary<string, string> MimeExtensions =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "image/jpeg", ".jpg" },
                { "image/jpg", ".jpg" },
                { "image/png", ".png" },
                { "image/webp", ".webp" },
                { "image/avif", ".avif" }
            };
        private static readonly HttpClient Http = CreateHttpClient();

        [STAThread]
        public static int Main(string[] args)
        {
            if (args != null && args.Length > 0 && args[0] == "--self-test-filedrop")
            {
                return RunFileDropSelfTest(args);
            }
            if (args != null && args.Length > 0 && args[0] == "--self-test-clipboard-apartment")
            {
                return RunClipboardApartmentSelfTest();
            }

            try
            {
                var request = ReadNativeMessage();
                var response = PrepareClipboardAsync(request).GetAwaiter().GetResult();
                WriteNativeMessage(response);
            }
            catch (HostException error)
            {
                WriteNativeMessage(ErrorResponse(error.Message));
            }
            catch
            {
                WriteNativeMessage(ErrorResponse("本地剪贴板助手处理失败。"));
            }
            return 0;
        }

        private static HttpClient CreateHttpClient()
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                UseDefaultCredentials = false
            };
            var client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(30)
            };
            client.DefaultRequestHeaders.TryAddWithoutValidation(
                "User-Agent",
                "GPT-Image2-Studio-Product-Image-Clipboard/1.1.29"
            );
            return client;
        }

        private static IDictionary<string, object> ReadNativeMessage()
        {
            var input = Console.OpenStandardInput();
            var lengthBytes = ReadExact(input, 4);
            var length = lengthBytes[0] |
                (lengthBytes[1] << 8) |
                (lengthBytes[2] << 16) |
                (lengthBytes[3] << 24);
            if (length <= 0 || length > MaxRequestBytes)
            {
                throw new HostException("复制图片请求超过 4 MiB 限制。");
            }
            var json = StrictUtf8.GetString(ReadExact(input, length));
            return RequireObject(Serializer.DeserializeObject(json), "复制图片请求格式无效。");
        }

        private static byte[] ReadExact(Stream stream, int length)
        {
            var buffer = new byte[length];
            var offset = 0;
            while (offset < length)
            {
                var read = stream.Read(buffer, offset, length - offset);
                if (read <= 0) throw new HostException("复制图片请求不完整。");
                offset += read;
            }
            return buffer;
        }

        private static void WriteNativeMessage(IDictionary<string, object> response)
        {
            var bytes = StrictUtf8.GetBytes(Serializer.Serialize(response));
            if (bytes.Length > MaxResponseBytes)
            {
                bytes = StrictUtf8.GetBytes(Serializer.Serialize(ErrorResponse("本地剪贴板助手响应过大。")));
            }
            var output = Console.OpenStandardOutput();
            var length = bytes.Length;
            output.WriteByte((byte)(length & 0xff));
            output.WriteByte((byte)((length >> 8) & 0xff));
            output.WriteByte((byte)((length >> 16) & 0xff));
            output.WriteByte((byte)((length >> 24) & 0xff));
            output.Write(bytes, 0, bytes.Length);
            output.Flush();
        }

        private static IDictionary<string, object> ErrorResponse(string message)
        {
            return new Dictionary<string, object>
            {
                { "ok", false },
                { "message", string.IsNullOrWhiteSpace(message) ? "复制图片失败。" : message }
            };
        }

        private static async Task<IDictionary<string, object>> PrepareClipboardAsync(
            IDictionary<string, object> request)
        {
            if (GetRequiredString(request, "type", 40) != "copy-images")
            {
                throw new HostException("本地剪贴板助手只接受复制图片请求。");
            }

            object manifestValue;
            if (!request.TryGetValue("manifest", out manifestValue))
            {
                throw new HostException("复制图片请求缺少商品图清单。");
            }
            var manifest = RequireObject(manifestValue, "商品图清单格式无效。");
            var items = ParseManifest(manifest);
            var root = Path.Combine(
                Path.GetTempPath(),
                "GPT-Image2-Studio",
                "product-image-clipboard"
            );
            var batchDir = Path.Combine(
                root,
                string.Format("batch-{0}-{1}", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Guid.NewGuid())
            );
            Directory.CreateDirectory(batchDir);

            try
            {
                var budget = new BatchBudget();
                var gate = new SemaphoreSlim(MaxConcurrency, MaxConcurrency);
                var tasks = items.Select(item => DownloadItemAsync(item, batchDir, gate, budget)).ToArray();
                var results = await Task.WhenAll(tasks).ConfigureAwait(false);
                var successfulPaths = FinalizeDownloads(results, batchDir);
                var failedCount = results.Length - successfulPaths.Count;
                if (successfulPaths.Count == 0)
                {
                    throw new HostException(string.Format(
                        "所选 {0} 张图片均未能准备，剪贴板未改变。",
                        results.Length
                    ));
                }

                SetFileDropClipboard(successfulPaths);
                CleanupPreviousBatches(root, batchDir);
                return new Dictionary<string, object>
                {
                    { "ok", true },
                    { "count", successfulPaths.Count },
                    { "failedCount", failedCount }
                };
            }
            catch
            {
                DeleteDirectory(batchDir);
                throw;
            }
        }

        private static List<ImageItem> ParseManifest(IDictionary<string, object> manifest)
        {
            if (GetInteger(manifest, "version") != 1)
            {
                throw new HostException("商品图清单版本不受支持。");
            }
            object sourceValue;
            if (!manifest.TryGetValue("source", out sourceValue))
            {
                throw new HostException("商品图清单缺少来源。");
            }
            var source = RequireObject(sourceValue, "商品图清单来源无效。");
            var platform = GetRequiredString(source, "platform", 20).ToLowerInvariant();
            var sourcePageUrl = GetRequiredString(source, "pageUrl", 4096);
            if (!IsTrustedSourceUrl(sourcePageUrl, platform))
            {
                throw new HostException("商品图清单必须来自受支持平台的商品详情页。");
            }

            object itemsValue;
            if (!manifest.TryGetValue("items", out itemsValue))
            {
                throw new HostException("商品图清单中没有图片。");
            }
            var rawItems = RequireList(itemsValue, "商品图清单图片格式无效。");
            if (rawItems.Count == 0 || rawItems.Count > MaxItemCount)
            {
                throw new HostException("商品图清单必须包含 1 至 1000 张图片。");
            }

            var parsed = new List<ImageItem>(rawItems.Count);
            var seenIds = new HashSet<string>(StringComparer.Ordinal);
            for (var index = 0; index < rawItems.Count; index += 1)
            {
                var rawItem = RequireObject(rawItems[index], "商品图条目格式无效。");
                var id = GetRequiredString(rawItem, "id", 120);
                if (!seenIds.Add(id)) throw new HostException("商品图清单包含重复 ID。");
                var category = GetRequiredString(rawItem, "category", 20).ToLowerInvariant();
                if (!Categories.Contains(category)) throw new HostException("商品图类别不受支持。");
                var imageUrl = GetRequiredString(rawItem, "url", 8192);
                if (!IsTrustedImageUrl(imageUrl, platform))
                {
                    throw new HostException("商品图图片地址不受支持。");
                }
                var filename = GetOptionalString(rawItem, "filename", 180);
                parsed.Add(new ImageItem
                {
                    Index = index,
                    Url = imageUrl,
                    Filename = SanitizeFilename(filename, category, index + 1),
                    Platform = platform
                });
            }
            return parsed;
        }

        private static async Task<DownloadResult> DownloadItemAsync(
            ImageItem item,
            string batchDir,
            SemaphoreSlim gate,
            BatchBudget budget)
        {
            await gate.WaitAsync().ConfigureAwait(false);
            string temporaryPath = null;
            try
            {
                var current = new Uri(item.Url, UriKind.Absolute);
                for (var redirect = 0; redirect <= MaxRedirects; redirect += 1)
                {
                    using (var request = new HttpRequestMessage(HttpMethod.Get, current))
                    using (var response = await Http.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead
                    ).ConfigureAwait(false))
                    {
                        if (IsRedirect(response.StatusCode))
                        {
                            if (redirect == MaxRedirects || response.Headers.Location == null)
                            {
                                throw new InvalidOperationException();
                            }
                            var redirected = response.Headers.Location.IsAbsoluteUri
                                ? response.Headers.Location
                                : new Uri(current, response.Headers.Location);
                            if (!IsTrustedImageUrl(redirected.AbsoluteUri, item.Platform))
                            {
                                throw new InvalidOperationException();
                            }
                            current = redirected;
                            continue;
                        }
                        if (!response.IsSuccessStatusCode) throw new InvalidOperationException();

                        var mimeType = response.Content.Headers.ContentType == null
                            ? ""
                            : (response.Content.Headers.ContentType.MediaType ?? "").ToLowerInvariant();
                        if (!MimeExtensions.ContainsKey(mimeType)) throw new InvalidOperationException();
                        var declaredLength = response.Content.Headers.ContentLength;
                        if (declaredLength.HasValue &&
                            (declaredLength.Value <= 0 || declaredLength.Value > MaxImageBytes))
                        {
                            throw new InvalidOperationException();
                        }

                        temporaryPath = Path.Combine(
                            batchDir,
                            string.Format(".download-{0:D4}-{1}.tmp", item.Index + 1, Guid.NewGuid())
                        );
                        long total = 0;
                        using (var input = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                        using (var output = new FileStream(
                            temporaryPath,
                            FileMode.CreateNew,
                            FileAccess.Write,
                            FileShare.None,
                            81920,
                            true))
                        {
                            var buffer = new byte[81920];
                            int read;
                            while ((read = await input.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false)) > 0)
                            {
                                total += read;
                                if (total > MaxImageBytes) throw new InvalidOperationException();
                                await output.WriteAsync(buffer, 0, read).ConfigureAwait(false);
                            }
                        }
                        if (total <= 0 || !budget.TryReserve(total)) throw new InvalidOperationException();
                        return new DownloadResult
                        {
                            Item = item,
                            Ok = true,
                            TemporaryPath = temporaryPath,
                            MimeType = mimeType,
                            Bytes = total
                        };
                    }
                }
            }
            catch
            {
                if (!string.IsNullOrEmpty(temporaryPath)) DeleteFile(temporaryPath);
            }
            finally
            {
                gate.Release();
            }
            return new DownloadResult { Item = item, Ok = false };
        }

        private static List<string> FinalizeDownloads(DownloadResult[] results, string batchDir)
        {
            var paths = new List<string>();
            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var result in results.OrderBy(value => value.Item.Index))
            {
                if (!result.Ok) continue;
                var filename = FilenameForMime(result.Item.Filename, result.MimeType, usedNames);
                var finalPath = Path.Combine(batchDir, filename);
                File.Move(result.TemporaryPath, finalPath);
                paths.Add(finalPath);
            }
            return paths;
        }

        private static string FilenameForMime(
            string requestedFilename,
            string mimeType,
            ISet<string> usedNames)
        {
            var extension = MimeExtensions[mimeType];
            var stem = Path.GetFileNameWithoutExtension(requestedFilename);
            if (string.IsNullOrWhiteSpace(stem)) stem = "商品图";
            if (stem.Length > 100) stem = stem.Substring(0, 100);
            var candidate = stem + extension;
            var suffix = 2;
            while (!usedNames.Add(candidate))
            {
                candidate = string.Format("{0}-{1}{2}", stem, suffix, extension);
                suffix += 1;
            }
            return candidate;
        }

        private static string SanitizeFilename(string value, string category, int order)
        {
            var raw = Path.GetFileName(value ?? "");
            var invalid = Path.GetInvalidFileNameChars();
            var builder = new StringBuilder();
            foreach (var character in raw)
            {
                builder.Append(invalid.Contains(character) || char.IsControl(character) ? '-' : character);
            }
            var result = Regex.Replace(builder.ToString(), @"\s+", " ").Trim().Trim('.');
            if (string.IsNullOrWhiteSpace(result))
            {
                var prefix = category == "main" ? "主图" : category == "detail" ? "详情图" : "SKU";
                result = string.Format("{0}-{1}.jpg", prefix, order);
            }
            if (result.Length > 140) result = result.Substring(0, 140).Trim().Trim('.');
            return string.IsNullOrWhiteSpace(result) ? string.Format("商品图-{0}.jpg", order) : result;
        }

        private static void SetFileDropClipboard(IList<string> filePaths)
        {
            var normalizedPaths = new List<string>(filePaths.Count);
            foreach (var path in filePaths)
            {
                if (!File.Exists(path)) throw new HostException("剪贴板图片文件准备失败。");
                normalizedPaths.Add(Path.GetFullPath(path));
            }

            var writeError = RunOnStaThread(() =>
            {
                var paths = new StringCollection();
                paths.AddRange(normalizedPaths.ToArray());
                ExternalException lastBusyError = null;
                for (var attempt = 0; attempt < 6; attempt += 1)
                {
                    try
                    {
                        Clipboard.SetFileDropList(paths);
                        return;
                    }
                    catch (ExternalException error)
                    {
                        if (!IsClipboardBusy(error)) throw;
                        lastBusyError = error;
                        if (attempt < 5) Thread.Sleep(100);
                    }
                }
                throw lastBusyError;
            });

            if (writeError == null) return;
            if (writeError is ExternalException && IsClipboardBusy((ExternalException)writeError))
            {
                throw new HostException("系统剪贴板正忙，自动重试仍未成功，请稍后再试。");
            }
            throw new HostException("系统剪贴板写入失败。");
        }

        private static bool IsClipboardBusy(ExternalException error)
        {
            return error != null && error.ErrorCode == ClipboardCannotOpenError;
        }

        private static Exception RunOnStaThread(Action action)
        {
            Exception failure = null;
            var thread = new Thread(() =>
            {
                try { action(); }
                catch (Exception error) { failure = error; }
            });
            thread.IsBackground = true;
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();
            return failure;
        }

        private static void CleanupPreviousBatches(string root, string currentBatch)
        {
            try
            {
                if (!Directory.Exists(root)) return;
                foreach (var directory in Directory.GetDirectories(root, "batch-*"))
                {
                    if (!string.Equals(directory, currentBatch, StringComparison.OrdinalIgnoreCase))
                    {
                        DeleteDirectory(directory);
                    }
                }
            }
            catch {}
        }

        private static bool IsRedirect(HttpStatusCode status)
        {
            var value = (int)status;
            return value == 301 || value == 302 || value == 303 || value == 307 || value == 308;
        }

        private static bool IsTrustedSourceUrl(string value, string platform)
        {
            Uri uri;
            if (!TryTrustedHttpsUri(value, out uri)) return false;
            var path = uri.AbsolutePath;
            if (platform == "1688")
            {
                return IsHostOrSubdomain(uri.Host, "1688.com") &&
                    Regex.IsMatch(path, @"^/offer/[^/.]+(?:\.html)?/?$", RegexOptions.IgnoreCase);
            }
            if (platform == "amazon")
            {
                return AmazonHosts.Any(host => IsHostOrSubdomain(uri.Host, host)) &&
                    Regex.IsMatch(path, @"/(?:dp|gp/product|gp/aw/d)/[a-z0-9]{10}(?:/|$)", RegexOptions.IgnoreCase);
            }
            if (platform == "temu")
            {
                return IsHostOrSubdomain(uri.Host, "temu.com") &&
                    (Regex.IsMatch(path, @"-g-\d+\.html/?$", RegexOptions.IgnoreCase) ||
                     (path.EndsWith("/goods.html", StringComparison.OrdinalIgnoreCase) &&
                      Regex.IsMatch(GetQueryValue(uri, "goods_id"), @"^\d+$")));
            }
            if (platform == "tiktok")
            {
                return (string.Equals(uri.Host, "www.tiktok.com", StringComparison.OrdinalIgnoreCase) &&
                        Regex.IsMatch(path, @"^/shop/pdp/(?:[^/]+/)?\d+/?$", RegexOptions.IgnoreCase)) ||
                    (string.Equals(uri.Host, "shop.tiktok.com", StringComparison.OrdinalIgnoreCase) &&
                     Regex.IsMatch(path, @"^/[a-z]{2}(?:-[a-z]{2})?/pdp/(?:[^/]+/)?\d+/?$", RegexOptions.IgnoreCase));
            }
            if (platform == "shein")
            {
                return IsHostOrSubdomain(uri.Host, "shein.com") &&
                    Regex.IsMatch(path, @"-p-\d+\.html/?$", RegexOptions.IgnoreCase);
            }
            if (platform == "gigacloud")
            {
                return IsHostOrSubdomain(uri.Host, "gigab2b.com") &&
                    path == "/index.php" &&
                    GetQueryValue(uri, "route") == "product/product" &&
                    Regex.IsMatch(GetQueryValue(uri, "product_id"), @"^[a-z0-9_-]{1,120}$", RegexOptions.IgnoreCase);
            }
            return false;
        }

        private static bool IsTrustedImageUrl(string value, string platform)
        {
            Uri uri;
            string[] suffixes;
            return TryTrustedHttpsUri(value, out uri) &&
                ImageHostSuffixes.TryGetValue(platform, out suffixes) &&
                suffixes.Any(suffix => IsHostOrSubdomain(uri.Host, suffix));
        }

        private static bool TryTrustedHttpsUri(string value, out Uri uri)
        {
            uri = null;
            Uri parsed;
            if (!Uri.TryCreate(value, UriKind.Absolute, out parsed) ||
                parsed.Scheme != Uri.UriSchemeHttps ||
                !string.IsNullOrEmpty(parsed.UserInfo) ||
                (!parsed.IsDefaultPort && parsed.Port != 443) ||
                parsed.HostNameType != UriHostNameType.Dns)
            {
                return false;
            }
            uri = parsed;
            return true;
        }

        private static bool IsHostOrSubdomain(string hostname, string suffix)
        {
            return string.Equals(hostname, suffix, StringComparison.OrdinalIgnoreCase) ||
                hostname.EndsWith("." + suffix, StringComparison.OrdinalIgnoreCase);
        }

        private static string GetQueryValue(Uri uri, string name)
        {
            var query = uri.Query.TrimStart('?').Split('&');
            foreach (var part in query)
            {
                if (string.IsNullOrWhiteSpace(part)) continue;
                var pair = part.Split(new[] { '=' }, 2);
                if (Uri.UnescapeDataString(pair[0]) == name)
                {
                    return pair.Length > 1 ? Uri.UnescapeDataString(pair[1]) : "";
                }
            }
            return "";
        }

        private static IDictionary<string, object> RequireObject(object value, string message)
        {
            var result = value as IDictionary<string, object>;
            if (result == null) throw new HostException(message);
            return result;
        }

        private static IList<object> RequireList(object value, string message)
        {
            var array = value as object[];
            if (array != null) return array;
            var list = value as ArrayList;
            if (list != null) return list.Cast<object>().ToList();
            throw new HostException(message);
        }

        private static string GetRequiredString(
            IDictionary<string, object> value,
            string key,
            int maxLength)
        {
            var result = GetOptionalString(value, key, maxLength);
            if (string.IsNullOrWhiteSpace(result)) throw new HostException("复制图片请求字段无效。");
            return result;
        }

        private static string GetOptionalString(
            IDictionary<string, object> value,
            string key,
            int maxLength)
        {
            object raw;
            if (!value.TryGetValue(key, out raw) || raw == null) return "";
            var result = Convert.ToString(raw).Trim();
            if (result.Length > maxLength) throw new HostException("复制图片请求字段过长。");
            return result;
        }

        private static int GetInteger(IDictionary<string, object> value, string key)
        {
            object raw;
            int result;
            return value.TryGetValue(key, out raw) && int.TryParse(Convert.ToString(raw), out result)
                ? result
                : 0;
        }

        private static void DeleteFile(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch {}
        }

        private static void DeleteDirectory(string path)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch {}
        }

        private static int RunFileDropSelfTest(string[] args)
        {
            try
            {
                int count;
                if (args.Length < 2 || !int.TryParse(args[1], out count) || count < 1 || count > MaxItemCount)
                {
                    throw new HostException("自检数量必须在 1 到 1000 之间。");
                }
                var root = Path.Combine(
                    Path.GetTempPath(),
                    "GPT-Image2-Studio",
                    "product-image-clipboard"
                );
                var batch = Path.Combine(
                    root,
                    string.Format("batch-self-test-{0}-{1}", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Guid.NewGuid())
                );
                Directory.CreateDirectory(batch);
                var png = Convert.FromBase64String(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                );
                var paths = new List<string>();
                for (var index = 0; index < count; index += 1)
                {
                    var path = Path.Combine(batch, string.Format("测试图片-{0:D4}.png", index + 1));
                    File.WriteAllBytes(path, png);
                    paths.Add(path);
                }
                Task.Run(() => SetFileDropClipboard(paths)).GetAwaiter().GetResult();
                CleanupPreviousBatches(root, batch);
                Console.OutputEncoding = new UTF8Encoding(false);
                Console.WriteLine(Serializer.Serialize(new Dictionary<string, object>
                {
                    { "ok", true },
                    { "count", count }
                }));
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error is HostException ? error.Message : "FileDrop self-test failed.");
                return 1;
            }
        }

        private static int RunClipboardApartmentSelfTest()
        {
            try
            {
                var apartment = "";
                Task.Run(() =>
                {
                    var error = RunOnStaThread(() =>
                    {
                        apartment = Thread.CurrentThread.GetApartmentState().ToString();
                    });
                    if (error != null) throw error;
                }).GetAwaiter().GetResult();

                if (!string.Equals(apartment, ApartmentState.STA.ToString(), StringComparison.Ordinal))
                {
                    throw new HostException("剪贴板线程未进入 STA 模式。");
                }
                Console.OutputEncoding = new UTF8Encoding(false);
                Console.WriteLine(Serializer.Serialize(new Dictionary<string, object>
                {
                    { "ok", true },
                    { "apartment", apartment }
                }));
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error is HostException ? error.Message : "Clipboard apartment self-test failed.");
                return 1;
            }
        }

        private sealed class HostException : Exception
        {
            public HostException(string message) : base(message) {}
        }

        private sealed class ImageItem
        {
            public int Index { get; set; }
            public string Url { get; set; }
            public string Filename { get; set; }
            public string Platform { get; set; }
        }

        private sealed class DownloadResult
        {
            public ImageItem Item { get; set; }
            public bool Ok { get; set; }
            public string TemporaryPath { get; set; }
            public string MimeType { get; set; }
            public long Bytes { get; set; }
        }

        private sealed class BatchBudget
        {
            private long totalBytes;

            public bool TryReserve(long bytes)
            {
                var total = Interlocked.Add(ref totalBytes, bytes);
                if (total <= MaxBatchBytes) return true;
                Interlocked.Add(ref totalBytes, -bytes);
                return false;
            }
        }
    }
}
