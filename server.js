/**
 * JinYu Frontend Server
 *
 * 环境变量（创建 frontend/.env 文件或通过系统环境注入）：
 *   PORT          前台监听端口，默认 3011
 *   ADMIN_HOST    后台服务 hostname，默认 127.0.0.1
 *   ADMIN_PORT    后台服务端口，默认 3020
 *   ADMIN_PROTOCOL http | https，默认 http
 *
 * 本地开发：无需任何配置，直接 node server.js 即可
 * VPS 生产：创建 frontend/.env，填写实际值
 */

// ── 翻译结果校验（防止垃圾翻译写入缓存）────────────────────────
// 过滤与原文明显无关的翻译结果（如 MyMemory 错误返回、email 注入等）
function isBadTranslation(originalText, translatedText) {
  if (!originalText || !translatedText || originalText === translatedText) return false;
  const t = translatedText.trim().toLowerCase();
  const o = originalText.trim().toLowerCase();
  // 过滤 email 相关垃圾（非 email 原文却翻译成 email）
  if (/^e-?mail/.test(t) && !/^e-?mail/.test(o)) return true;
  // 过滤只剩标点和 emoji 的翻译
  if (/^[^\w\u4e00-\u9fff]{0,5}$/.test(t)) return true;
  // 过滤 HTML 标签残留
  if (/<\w+[^>]*>/.test(t) && !/<\w+[^>]*>/.test(o)) return true;
  return false;
}

// ── 加载 .env（如果存在）──────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
}

// ── Hero 标题 SSR 注入（避免刷新瞬间先闪 HTML 里写死的旧标题）────
const HOME_SETTINGS_PATH = process.env.HOME_SETTINGS_PATH ||
  path.join(__dirname, '..', 'jinyu1.0admin', 'data', 'home-settings.json');

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 与前端 renderTitleHtml 保持一致：高亮词包 hero-accent，\n 转 <br>
function renderHeroTitleHtml(plainText, highlights) {
  if (!plainText) return '';
  let text = escHtml(plainText);
  const list = (highlights || []).filter(h => h && h.trim()).map(h => escHtml(h.trim()));
  if (list.length) {
    const pattern = list.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp('(' + pattern + ')', 'g');
    text = text.split(re).map(part =>
      part === undefined ? '' : (list.indexOf(part) !== -1 ? '<span class="hero-accent">' + part + '</span>' : part)
    ).join('');
  }
  return text.replace(/\n/g, '<br>');
}

function readHeroTitleHtml() {
  try {
    const d = JSON.parse(fs.readFileSync(HOME_SETTINGS_PATH, 'utf8'));
    const hero = (d && d.hero) || {};
    return renderHeroTitleHtml(hero.title, hero.highlights);
  } catch (e) {
    return '';
  }
}

// 读取后台配置的 Hero 背景图 URL，供 SSR 注入首屏，避免刷新瞬间先闪 HTML 里写死的旧背景图。
// 优先级：首页管理 hero.backgroundImage > 公司介绍 company_image > 默认 factory-hero.jpg
function readHeroBgUrl() {
  const fallback = '/images/factory-hero.jpg';
  try {
    const d = JSON.parse(fs.readFileSync(HOME_SETTINGS_PATH, 'utf8'));
    const hero = (d && d.hero) || {};
    if (hero.backgroundImage && String(hero.backgroundImage).trim()) {
      return String(hero.backgroundImage);
    }
  } catch (e) {}
  try {
    const companyPath = path.join(__dirname, '..', 'jinyu1.0admin', 'data', 'company.json');
    const c = JSON.parse(fs.readFileSync(companyPath, 'utf8'));
    if (c && c.company_image && String(c.company_image).trim()) {
      return String(c.company_image);
    }
  } catch (e) {}
  return fallback;
}

// 读取后台“联系我们”维护的联系方式图片 URL 列表（仅接受站内路径或 http(s)，防注入）
function readContactImages() {
  try {
    const d = JSON.parse(fs.readFileSync(HOME_SETTINGS_PATH, 'utf8'));
    const arr = (d && d.contactImages) || [];
    if (Array.isArray(arr)) {
      return arr.filter((u) => typeof u === 'string' && (u.startsWith('/') || /^https?:\/\//.test(u)));
    }
    return [];
  } catch (e) {
    return [];
  }
}

// ── 腾讯云机器翻译兜底（MyMemory 用完后自动切换）────────────────────
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';

function sendTencentCloud(text, from, to, res) {
  if (!text || !text.trim()) {
    res.end(JSON.stringify({ success: false, result: text }));
    return true;
  }

  const service = 'tmt';
  const host = 'tmt.tencentcloudapi.com';
  const action = 'TextTranslate';
  const version = '2018-03-21';
  const region = 'ap-guangzhou';
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Math.floor(Math.random() * 1000000);

  const sourceMap = { en: 'en', zh: 'zh', vi: 'vi', fil: 'fil', tl: 'fil' };
  const Source = sourceMap[from] || from;
  const Target = sourceMap[to] || to;

  const payload = JSON.stringify({
    SourceText: text,
    Source: Source,
    Target: Target,
    ProjectId: 0
  });

  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalHeaders = 'content-type:application/json\nhost:' + host + '\n';
  const signedHeaders = 'content-type;host';
  const canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + hashedPayload;
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = new Date().toISOString().slice(0, 10) + '/' + service + '/tc3_request';
  const stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  const kDate = crypto.createHmac('sha256', 'TC3' + TENCENT_SECRET_KEY).update(new Date().toISOString().slice(0, 10)).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = algorithm + ' Credential=' + TENCENT_SECRET_ID + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  const options = {
    hostname: host,
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Region': region,
      'Authorization': authorization,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  let tcBody = '';
  const req = https.request(options, tcRes => {
    tcRes.on('data', d => { tcBody += d; });
    tcRes.on('end', () => {
      try {
        const j = JSON.parse(tcBody);
        const result = j.Response && j.Response.TargetText;
        if (result && result.trim() && !isBadTranslation(text, result)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, result: result.trim() }));
        }
        if (j.Response && j.Response.Error) {
          console.log('腾讯云错误:', j.Response.Error.Code, j.Response.Error.Message);
        }
      } catch(e) { console.log('解析腾讯云响应失败:', e.message); }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, result: text }));
    });
  });
  req.on('error', e => {
    console.log('腾讯云请求失败:', e.message);
    res.end(JSON.stringify({ success: false, result: text }));
  });
  req.setTimeout(8000, () => { req.destroy(); res.end(JSON.stringify({ success: false, result: text })); });
  req.write(payload);
  req.end();
  return true;
}

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

const PORT          = parseInt(process.env.PORT)          || 3011;
const ADMIN_HOST    = process.env.ADMIN_HOST              || '127.0.0.1';
const ADMIN_PORT    = parseInt(process.env.ADMIN_PORT)    || 3006;
const ADMIN_PROTO   = process.env.ADMIN_PROTOCOL          || 'http';  // http | https

// 本地开发时图片走线上 MinIO 代理（避免本地起 MinIO）
const REMOTE_IMAGE_ORIGIN = process.env.REMOTE_IMAGE_ORIGIN || 'https://jinyumaterial.com';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

// ── 翻译缓存持久化（供 autoTranslate.saveToI18nCache 调用）─────────
const TRANS_FILE = path.join(__dirname, 'translations.json');

function readTranslations() {
  if (!fs.existsSync(TRANS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(TRANS_FILE, 'utf8')); }
  catch { return {}; }
}

function writeTranslations(data) {
  try {
    fs.writeFileSync(TRANS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch(e) {
    console.warn('[i18n] write failed:', e.message);
    return false;
  }
}

function recordNewsView(slug) {
  if (!slug || typeof slug !== 'string') return;
  // 通过 HTTP 请求调用后台 API 记录新闻浏览量
  const url = `${ADMIN_PROTO}://${ADMIN_HOST}:${ADMIN_PORT}/api/news/${slug}/view`;
  http.get(url, (res) => {
    // 忽略响应
  }).on('error', () => {
    // 忽略错误，不影响访问
  });
}

function recordPageview(pathname, slug, clientIp) {
  const ext = path.extname(pathname).toLowerCase();
  const STATIC_EXTS = ['.js','.css','.json','.png','.jpg','.jpeg','.gif','.svg','.ico','.webp','.woff','.woff2','.ttf','.eot','.map'];
  if (STATIC_EXTS.includes(ext)) return;
  if (ext && ext !== '.html') return;
  if (pathname.startsWith('/images/')) return;

  console.log('[Track] 记录访问:', pathname, 'slug:', slug, 'ip:', clientIp);

  // 通过 HTTP 请求调用后台 API 记录访问量，同时把真实用户 IP 透传过去
  const postData = JSON.stringify({ path: pathname, slug: slug });
  const options = {
    hostname: ADMIN_HOST,
    port: ADMIN_PORT,
    path: '/api/track',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-From-Frontend': '1',
      'X-Forwarded-For': clientIp || '127.0.0.1',
      'X-Real-IP': clientIp || '127.0.0.1',
    }
  };

  const req = http.request(options, (res) => {
    console.log('[Track] 后台响应:', res.statusCode);
  });
  req.on('error', (err) => {
    console.error('[Track] 调用失败:', err.message);
  });
  req.write(postData);
  req.end();

  // 如果是新闻详情页，记录该文章的浏览量
  if (slug) {
    recordNewsView(slug);
  }
}

// ── 反向代理（将 /api/* /images/* /uploads/* 转发到后台）─────────
function proxyToAdmin(req, res) {
  const transport = ADMIN_PROTO === 'https' ? https : http;

  const options = {
    hostname: ADMIN_HOST,
    port:     ADMIN_PORT,
    path:     req.url,
    method:   req.method,
    headers: {
      ...req.headers,
      host: `${ADMIN_HOST}:${ADMIN_PORT}`,
      'X-From-Frontend': '1',
    },
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Admin service unavailable' }));
  });

  req.pipe(proxyReq, { end: true });
}

// ── 图片远程代理（本地开发时代理 /jinyu-images/* 到线上 MinIO）────
function proxyToRemoteImages(req, res) {
  const remoteUrl = `${REMOTE_IMAGE_ORIGIN}${req.url}`;
  const remoteReq = https.get(remoteUrl, (remoteRes) => {
    res.writeHead(remoteRes.statusCode, remoteRes.headers);
    remoteRes.pipe(res, { end: true });
  });
  remoteReq.on('error', (err) => {
    console.error('[image proxy error]', err.message, remoteUrl);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Image unavailable' }));
  });
  remoteReq.setTimeout(15000, () => {
    remoteReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Image timeout' }));
    }
  });
}

// ── 产品详情API：从产品列表中查找单个产品 ───────────────────────
function handleProductDetail(req, res, productId) {
  const urlStr = `http://${ADMIN_HOST}:${ADMIN_PORT}/api/products`;

  const transport2 = ADMIN_PROTO === 'https' ? https : http;
  const req2 = transport2.get(urlStr, { headers: { 'X-From-Frontend': '1' } }, (apiRes) => {
    let body = '';
    apiRes.on('data', d => { body += d; });
    apiRes.on('end', () => {
      try {
        const products = JSON.parse(body);
        const prodArray = Array.isArray(products) ? products : (products.value || products.data || []);
        // 先按 ID 匹配（数字路由）
        let product = prodArray.find(p => String(p.id) === String(productId));
        // ID 没匹配 → 按 name_en slug 匹配
        if (!product) {
          const slug = productId.toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '');
          product = prodArray.find(p => {
            const pSlug = (p.name_en || p.name || '').toLowerCase()
              .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
              .replace(/^-+|-+$/g, '');
            return pSlug === slug;
          });
        }

        if (product) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: product }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Product not found' }));
        }
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Failed to fetch products' }));
      }
    });
  }).on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Admin service unavailable' }));
  });
}

// ── 翻译代理（国内可访问，服务端转发）──────────────────────────
// GET /api/translate?text=...&from=zh&to=en
// 主接口：有道翻译（无需Key，国内稳定）— 适用于 zh/en/vi
// 菲律宾语(tl)专用：微软 Edge Translate（有道不支持 tl）
// ============================================================
// 产品/案例详情页 SSR 元信息注入（SEO：让爬虫/社交机器人拿到真实标题与描述）
// ============================================================
const SITE_BASE = 'https://www.jinyumaterial.com';

function escAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateMeta(str, n) {
  n = n || 160;
  str = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
  if (str.length <= n) return str;
  const cut = str.lastIndexOf(' ', n);
  return (cut > 0 ? str.slice(0, cut) : str.slice(0, n)) + '…';
}

function buildProductMeta(p) {
  const name = p.name_en || p.name || 'Product';
  const desc = truncateMeta(p.description_en || p.description || '');
  const imgs = (p.images && p.images.length) ? p.images
    : (p.main_image ? [p.main_image] : (p.img ? [p.img] : []));
  const raw = imgs[0] || '';
  const img = raw && /^https?:\/\//.test(raw) ? raw
    : (raw ? SITE_BASE + raw : SITE_BASE + '/images/factory-hero.jpg');
  return {
    title: name + ' | Jin Yu Advertising Materials',
    description: desc,
    image: img,
    url: SITE_BASE + '/products/' + encodeURIComponent(p.id),
  };
}

function buildCaseMeta(c) {
  const en = (c.langData && c.langData.en) || {};
  const title = en.title || c.title || 'Case Study';
  const desc = truncateMeta(en.content || c.content || '');
  const imgs = (c.images && c.images.length) ? c.images : [];
  const raw = imgs[0] || '';
  const img = raw && /^https?:\/\//.test(raw) ? raw
    : (raw ? SITE_BASE + raw : SITE_BASE + '/images/factory-hero.jpg');
  return {
    title: title + ' | Jin Yu Advertising Materials',
    description: desc,
    image: img,
    url: SITE_BASE + '/cases/' + encodeURIComponent(c.slug || c.id),
  };
}

function injectMetaIntoHtml(s, meta) {
  const t = escAttr(meta.title);
  const d = escAttr(meta.description);
  const i = escAttr(meta.image);
  const u = escAttr(meta.url);
  s = s.replace(/<title>[^<]*<\/title>/, '<title>' + t + '</title>');
  s = s.replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="' + t + '"');
  s = s.replace(/<meta name="twitter:title" content="[^"]*"/, '<meta name="twitter:title" content="' + t + '"');
  s = s.replace(/<meta property="og:description" content="[^"]*"/, '<meta property="og:description" content="' + d + '"');
  s = s.replace(/<meta name="twitter:description" content="[^"]*"/, '<meta name="twitter:description" content="' + d + '"');
  s = s.replace(/<meta property="og:image" content="[^"]*"/, '<meta property="og:image" content="' + i + '"');
  s = s.replace(/<meta name="twitter:image" content="[^"]*"/, '<meta name="twitter:image" content="' + i + '"');
  if (!/rel="canonical"/.test(s)) {
    s = s.replace(/(<meta property="og:site_name"[^>]*>)/, '$1\n  <link rel="canonical" href="' + u + '" />');
  }
  if (!/property="og:url"/.test(s)) {
    s = s.replace(/(<meta property="og:site_name"[^>]*>)/, '$1\n  <meta property="og:url" content="' + u + '" />');
  }
  if (!/<meta name="description"/.test(s)) {
    s = s.replace(/(<meta property="og:site_name"[^>]*>)/, '$1\n  <meta name="description" content="' + d + '" />');
  }
  return s;
}

function serveDetailWithMeta(req, res, opts) {
  const { pathname, filePath, contentType, slug } = opts;
  const isCase = pathname === '/case-detail.html';
  const apiPath = isCase ? '/api/case-studies' : '/api/products';
  const urlStr = `http://${ADMIN_HOST}:${ADMIN_PORT}${apiPath}`;
  const finish = (meta, { notFound = false } = {}) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1>');
        return;
      }
      let html = data.toString();
      if (meta) {
        html = injectMetaIntoHtml(html, meta);
      }
      if (notFound) {
        // 软 404：错误 slug 返回 404 + noindex，避免死链被搜索引擎收录
        html = html.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
      }
      res.writeHead(notFound ? 404 : 200, { 'Content-Type': contentType, 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
      res.end(Buffer.from(html, 'utf8'));
    });
  };
  if (!slug) return finish(null);
  http.get(urlStr, { headers: { 'X-From-Frontend': '1' } }, (apiRes) => {
    let body = '';
    apiRes.on('data', (d) => { body += d; });
    apiRes.on('end', () => {
      let meta = null;
      let itemFound = false;
      try {
        const json = JSON.parse(body);
        const arr = Array.isArray(json) ? json : (json.data || json.value || []);
        const item = isCase
          ? arr.find((c) => String(c.slug) === String(slug) || String(c.id) === String(slug))
          : arr.find((p) => String(p.id) === String(slug));
        if (item) { meta = isCase ? buildCaseMeta(item) : buildProductMeta(item); itemFound = true; }
      } catch (e) { /* 解析失败时回退到基线模板 */ }
      if (!itemFound) {
        // slug 存在但后台无此数据 → 软 404（返回 404 + noindex）
        return finish(null, { notFound: true });
      }
      finish(meta);
    });
  }).on('error', () => {
    finish(null); // 后台不可用时仍回退 200（避免全站变 404）
  });
}

// 兜底接口：MyMemory（全球可用）
function handleTranslate(req, res) {
  const parsedQ = url.parse(req.url, true);
  const { text, from, to } = parsedQ.query;
  if (!text || !to) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: false, result: text || '' }));
  }

  // ── 菲律宾语(tl)：走微软 Edge Translate（有道不支持 tl）──
  if (to === 'tl' || to === 'fil' || to === 'ph') {
    return handleMsTranslate(req, res, text, from, to);
  }

  // 语言代码映射（有道格式）
  const YOUDAO_LANG = { zh: 'zh-CHS', en: 'en', vi: 'vi', auto: 'auto' };
  const fromCode = YOUDAO_LANG[from] || 'auto';
  const toCode   = YOUDAO_LANG[to]   || 'en';

  // 有道免费接口
  const youdaoPath = '/translate?doctype=json&type=' + fromCode + '2' + toCode
    + '&i=' + encodeURIComponent(text);

  const youdaoOpt = {
    hostname: 'fanyi.youdao.com',
    path: youdaoPath,
    method: 'GET',
    timeout: 5000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fanyi.youdao.com/' }
  };

  function fallbackMyMemory(originalText) {
    // MyMemory 免费接口（备用）
    const mmLang = { zh: 'zh-CN', en: 'en', vi: 'vi', tl: 'tl' };
    const langPair = (mmLang[from] || 'en') + '|' + (mmLang[to] || 'en');
    const mmPath = '/get?q=' + encodeURIComponent(originalText) + '&langpair=' + encodeURIComponent(langPair);
    const mmOpt = {
      hostname: 'api.mymemory.translated.net',
      path: mmPath,
      method: 'GET',
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
    let body = '';
    const mmReq = https.request(mmOpt, mmRes => {
      mmRes.on('data', d => { body += d; });
      mmRes.on('end', () => {
        try {
          const j = JSON.parse(body);
          const translated = j.responseData && j.responseData.translatedText;
          // 过滤 MyMemory 警告文本和超限提示 + 垃圾翻译
          if (translated && !translated.includes('MYMEMORY WARNING') && !translated.includes('QUERY LENGTH LIMIT') && translated !== 'USAGE LIMIT EXCEEDED' && !isBadTranslation(originalText, translated)) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ success: true, result: translated }));
          }
        } catch(e) {}
        // MyMemory 失败 → 腾讯云兜底
        if (sendTencentCloud(originalText, from, to, res)) return;
        // 全部失败，返回原文
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, result: originalText }));
      });
    });
    mmReq.on('error', () => {
      if (!sendTencentCloud(originalText, from, to, res)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, result: originalText }));
      }
    });
    mmReq.end();
  }

  let body = '';
  const ydReq = https.request(youdaoOpt, ydRes => {
    ydRes.on('data', d => { body += d; });
    ydRes.on('end', () => {
      try {
        const j = JSON.parse(body);
        // 有道返回格式：{ translateResult: [[{tgt:"..."}]], errorCode: "0" }
        const tgt = j.translateResult && j.translateResult[0] && j.translateResult[0][0] && j.translateResult[0][0].tgt;
        if (j.errorCode === '0' && tgt && !isBadTranslation(text, tgt)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, result: tgt }));
        }
      } catch(e) {}
      // 有道失败，走备用 MyMemory
      fallbackMyMemory(text);
    });
  });
  ydReq.on('error', () => fallbackMyMemory(text));
  ydReq.end();
}

// ── 微软 Edge 翻译（用于菲律宾语等有道不支持的语言）──
let _msToken = null;
let _msTokenExpiry = 0;

function getMsToken(cb) {
  if (_msToken && Date.now() < _msTokenExpiry) return cb(null, _msToken);
  const req = https.request('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 8000
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      _msToken = d.trim();
      _msTokenExpiry = Date.now() + 9 * 60 * 1000;
      cb(null, _msToken);
    });
  });
  req.on('error', cb);
  req.on('timeout', () => { req.destroy(); cb(new Error('timeout')); });
  req.end();
}

function handleMsTranslate(req, res, text, from, to) {
  getMsToken(function(err, token) {
    if (err || !token) {
      // 微软失败，fallback 到 MyMemory
      return fallbackMyMemoryForTl(text, from, to, res);
    }

    const msLangMap = { 'en': 'en', 'zh': 'zh-Hans', 'vi': 'vi', 'tl': 'fil', 'fil': 'fil', 'ph': 'fil' };
    const msFrom = msLangMap[from] || 'auto';
    const msTo   = msLangMap[to]   || 'fil';
    
    const msUrlObj = new URL('https://api-edge.cognitive.microsofttranslator.com/translate?from=' + msFrom + '&to=' + msTo + '&api-version=3.0&textType=plain');
    
    const msBody = JSON.stringify([{ Text: text }]);
    const msReq = https.request({
      hostname: msUrlObj.hostname,
      path: msUrlObj.pathname + msUrlObj.search,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, msRes => {
      let msBody = '';
      msRes.on('data', d => msBody += d);
      msRes.on('end', () => {
        try {
          const j = JSON.parse(msBody);
          const result = j?.[0]?.translations?.[0]?.text;
          if (result && result.trim() && !isBadTranslation(text, result)) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ success: true, result: result.trim() }));
          }
        } catch(e) {}
        fallbackMyMemoryForTl(text, from, to, res);
      });
    });
    msReq.on('error', () => fallbackMyMemoryForTl(text, from, to, res));
    msReq.on('timeout', () => { msRes.destroy(); fallbackMyMemoryForTl(text, from, to, res); });
    msReq.write(msBody);
    msReq.end();
  });
}

function fallbackMyMemoryForTl(originalText, from, to, res) {
  const mmLang = { zh: 'zh-CN', en: 'en', vi: 'vi', tl: 'tl' };
  const langPair = (mmLang[from] || 'en') + '|' + (mmLang[to] || 'tl');
  const mmPath = '/get?q=' + encodeURIComponent(originalText) + '&langpair=' + encodeURIComponent(langPair);
  const mmOpt = {
    hostname: 'api.mymemory.translated.net',
    path: mmPath,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  let body = '';
  const mmReq = https.request(mmOpt, mmRes => {
    mmRes.on('data', d => { body += d; });
    mmRes.on('end', () => {
      try {
        const j = JSON.parse(body);
        const translated = j.responseData && j.responseData.translatedText;
        if (translated && !translated.includes('MYMEMORY WARNING') && !translated.includes('QUERY LENGTH LIMIT') && translated !== 'USAGE LIMIT EXCEEDED' && !isBadTranslation(originalText, translated)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, result: translated }));
        }
      } catch(e) {}
      // MyMemory 失败 → 腾讯云兜底（菲律宾语也支持）
      if (sendTencentCloud(originalText, from, to, res)) return;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, result: originalText }));
    });
  });
  mmReq.on('error', () => {
    if (!sendTencentCloud(originalText, from, to, res)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, result: originalText }));
    }
  });
  mmReq.end();
}

// ── i18n PUT 写入限速（防止恶意刷写翻译缓存）──────────────────────
const i18nWriteAttempts = new Map();
function checkI18nWriteRate(clientIp) {
  const now = Date.now();
  const record = i18nWriteAttempts.get(clientIp) || { count: 0, firstAt: now };
  if (now - record.firstAt > 10 * 60 * 1000) { // 10分钟窗口
    record.count = 0;
    record.firstAt = now;
  }
  if (record.count >= 30) return false; // 每 IP 10分钟最多 30 次写入
  record.count++;
  i18nWriteAttempts.set(clientIp, record);
  return true;
}

// ── 安全 HTTP 头（注入到所有响应）──────────────────────────────────
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// ── HTTP 服务器 ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // 注入安全头到所有响应
  setSecurityHeaders(res);
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // 翻译代理（国内可访问）
  if (pathname === '/api/translate' && req.method === 'GET') return handleTranslate(req, res);

  // POST /api/translate（i18n.js 用 POST）
  if (pathname === '/api/translate' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { text, from, to } = JSON.parse(body);
        // 复用 GET 处理逻辑，但用查询参数形式
        const modifiedReq = { url: `/api/translate?text=${encodeURIComponent(text || '')}&from=${from || 'auto'}&to=${to || 'en'}` };
        handleTranslate(modifiedReq, res);
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, result: '' }));
      }
    });
    return;
  }

  // POST /api/translate/batch（i18n.js autoTranslateMissing 用）
  if (pathname === '/api/translate/batch' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { from, to, texts } = JSON.parse(body);
        const results = {};
        const entries = Object.entries(texts || {});
        for (const [key, text] of entries) {
          // 逐条翻译（复用 handleTranslate GET 逻辑）
          await new Promise(resolve => {
            const modifiedReq = { url: `/api/translate?text=${encodeURIComponent(text || '')}&from=${from || 'auto'}&to=${to || 'en'}` };
            // 捕获翻译结果
            const origEnd = res.end.bind(res);
            const chunks = [];
            const newRes = {
              writeHead: () => {},
              end: (data) => {
                try {
                  const j = JSON.parse(data || '{}');
                  results[key] = j.result || j.translatedText || text;
                } catch(e2) {
                  results[key] = text;
                }
                resolve();
              },
              on: (e, cb) => {
                if (e === 'data') return cb('');
                if (e === 'end') return resolve();
              }
            };
            handleTranslate(modifiedReq, newRes);
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ translations: results }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ translations: {} }));
      }
    });
    return;
  }

  // ── 翻译缓存持久化 API ───────────────────────────────────────────
  // GET /api/i18n/:lang  代理到后台 admin（后台有完整翻译数据）
  const i18nGetMatch = pathname.match(/^\/api\/i18n\/([a-z]{2}(-[A-Z]{2})?)$/);
  if (i18nGetMatch && req.method === 'GET') {
    const lang = i18nGetMatch[1];
    // 本地缓存 key 标准化（前台 translations.json 使用短码 zh/vi/tl，非 zh-CN/vi-VN）
    const LOCAL_LANG_MAP = { 'zh-CN': 'zh', 'vi-VN': 'vi', 'tl-PH': 'tl', 'fil-PH': 'tl' };
    const localLang = LOCAL_LANG_MAP[lang] || lang;
    const local = readTranslations();
    const localData = local[localLang] || {};
    // 后台翻译数据的语言码（后台只有 zh/vi/tl/fil/en，无 zh-CN/vi-VN）
    const adminLang = LOCAL_LANG_MAP[lang] || lang;
    const adminUrl = `http://${ADMIN_HOST}:${ADMIN_PORT}/api/i18n/${adminLang}`;
    http.get(adminUrl, (adminRes) => {
      let data = '';
      adminRes.on('data', c => data += c);
      adminRes.on('end', () => {
        try {
          const adminData = JSON.parse(data) || {};
          // 检测是否是真正的数组格式（只有 Array.isArray 能准确判断）
          // 数组才 fallback 到本地缓存；对象（含混有数字键的翻译对象）正常合并
          // 合并：后台基础翻译 + 本地动态翻译（后者覆盖前者）
          const merged = Array.isArray(adminData) ? { ...localData } : { ...adminData, ...localData };
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(merged));
        } catch(e) {
          // 后台挂了也返回本地数据
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(localData));
        }
      });
    }).on('error', () => {
      // 后台不可达时返回本地缓存
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(localData));
    });
    return;
  }
  // PUT /api/i18n/:lang  写入/合并翻译 key（用于 autoTranslate 缓存持久化）
  // 安全措施：Origin 校验（仅允许同源）+ 限速（防恶意刷写）+ key 数量限制
  const i18nPutMatch = pathname.match(/^\/api\/i18n\/([a-z]{2}(-[A-Z]{2})?)$/);
  if (i18nPutMatch && req.method === 'PUT') {
    // ① Origin 校验：浏览器 fetch PUT 必带 Origin，校验是否同站
    const origin = req.headers['origin'] || '';
    const allowedOriginPattern = /^https?:\/\/(www\.)?jinyumaterial\.com(:\d+)?$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (origin && !allowedOriginPattern.test(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, error: 'Forbidden origin' }));
    }
    // ② 限速
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (!checkI18nWriteRate(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, error: 'Too many requests, try later' }));
    }
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const lang = i18nPutMatch[1];
        const LOCAL_LANG_MAP = { 'zh-CN': 'zh', 'vi-VN': 'vi', 'tl-PH': 'tl', 'fil-PH': 'tl' };
        const localLang = LOCAL_LANG_MAP[lang] || lang;
        const updates = JSON.parse(body);
        if (!updates || typeof updates !== 'object') throw new Error('Invalid body');
        // ③ 限制单次写入 key 数量（防大量写入攻击）
        const keys = Object.keys(updates);
        if (keys.length > 100) throw new Error('Too many keys (max 100)');
        const translations = readTranslations();
        if (!translations[localLang]) translations[localLang] = {};
        let count = 0;
        Object.entries(updates).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            translations[localLang][key.trim()] = value.trim();
            count++;
          }
        });
        writeTranslations(translations);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 新闻浏览量 API：代理到后台
  const newsViewsMatch = pathname.match(/^\/api\/news-views\/(.+)$/);
  if (newsViewsMatch) {
    return proxyToAdmin(req, res);
  }

  // 所有新闻浏览量 API：代理到后台
  if (pathname === '/api/news-views' && req.method === 'GET') {
    return proxyToAdmin(req, res);
  }

  // 产品 by-slug API：代理到后台（不走 handleProductDetail）
  if (pathname.startsWith('/api/products/by-slug/')) return proxyToAdmin(req, res);
  
  // 案例研究 by-slug API：代理到后台
  if (pathname.startsWith('/api/case-studies/by-slug/')) return proxyToAdmin(req, res);

  // 产品详情API：/api/products/{id} → 从产品列表中查找
  const productDetailMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productDetailMatch) return handleProductDetail(req, res, productDetailMatch[1]);

  // /api/applications → /api/scenarios（别名路由，转换数据格式）
  if (pathname === '/api/applications') {
    const scenariosUrl = `http://${ADMIN_HOST}:${ADMIN_PORT}/api/scenarios`;
    http.get(scenariosUrl, (apiRes) => {
      let body = '';
      apiRes.on('data', d => { body += d; });
      apiRes.on('end', () => {
        try {
          // 后台存 nested {descriptionsByLang:{en,zh,vi,ph}} → 转为前台 flat {_en,_zh,_vi,_tl}
          const raw = JSON.parse(body);
          // 兼容两种格式：{success,data} 或 直接数组
          const scenariosData = raw.data || raw;
          const flat = (Array.isArray(scenariosData) ? scenariosData : []).map(s => ({
            id: s.id,
            slug: s.slug || '',
            image: s.image || '',
            images: s.images || [],
            name_en: s.name_en || s.name || '',
            name_zh: s.name_zh || '',
            name_vi: s.name_vi || '',
            name_tl: s.name_tl || '',
            description_en: s.description_en || '',
            description_zh: s.description_zh || '',
            description_vi: s.description_vi || '',
            description_tl: s.description_tl || '',
            // 推荐材料（后台已扁平化）
            materials: Array.isArray(s.materials) ? s.materials.map(m => ({
              id: m.id,
              name: m.name || m.name_en || '',
              name_en:  m.name_en  || '',
              name_zh:  m.name_zh  || '',
              name_vi:  m.name_vi  || '',
              name_tl:  m.name_tl  || '',
              desc: m.desc || m.description_en || '',
              description_en:  m.description_en  || '',
              description_zh:  m.description_zh  || '',
              description_vi:  m.description_vi  || '',
              description_tl:  m.description_tl  || '',
            })) : []
          }));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: flat }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Parse error' }));
        }
      });
    }).on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin unavailable' }));
    });
    return;
  }

  // /api/* → 代理到后台
  if (pathname.startsWith('/api/')) return proxyToAdmin(req, res);

  // 图片/上传目录 → 代理到后台（后台上传的图片可在前台访问）
  if (pathname.startsWith('/uploads/')
   || pathname.startsWith('/admin-images/')
   || pathname.startsWith('/about-uploads/')
   || pathname.startsWith('/homepage-uploads/')
   || pathname.startsWith('/case-uploads/')
   || pathname.startsWith('/product-images/')) {
    return proxyToAdmin(req, res);
  }

  // MinIO 图片（产品图、案例图）→ 代理到线上站点，避免本地起 MinIO
  if (pathname.startsWith('/jinyu-images/')) {
    return proxyToRemoteImages(req, res);
  }

  // 根路径 → index.html
  if (pathname === '/') pathname = '/index.html';

  // ── 干净 URL 路由（Clean URL rewrite）────────────────────────────
  // /products              → products.html
  // /products/:slug       → product-detail.html（SEO 友好 URL）
  // /products/:catSlug     → products.html
  // /products/:catSlug/:productSlug → product-detail.html
  // /about                 → about.html
  // /contact               → contact.html
  // /applications          → applications.html
  // /case-studies          → case-studies.html
  // ── 路由重写前日志 ──────────────────────────────
  const startTime = Date.now();
  const originalPathname = pathname;
  const originalQuery = parsedUrl.query;
  console.log('[Rewrite] ===========================================');
  console.log('[Rewrite] 请求时间:', new Date().toISOString());
  console.log('[Rewrite] 原始路径:', originalPathname);
  console.log('[Rewrite] 原始查询:', originalQuery || '(空)');
  console.log('[Rewrite] 请求方法:', req.method);
  console.log('[Rewrite] User-Agent:', req.headers['user-agent'] || '(空)');
  console.log('[Rewrite] Referer:', req.headers['referer'] || '(空)');
  console.log('[Rewrite] ─────────────────────────────────────────');

  // ── Products 路由重写 ──────────────────────────────
  if (pathname === '/products') {
    const q = parsedUrl.query || '';
    if (q && (q.includes('id=') || q.includes('slug='))) {
      pathname = '/product-detail.html';
    } else {
      pathname = '/products.html';
    }
    console.log('[Rewrite] /products →', pathname, 'search:', parsedUrl.search);
  }
  // /products/category/:catSlug → products.html?category=:catSlug
  else if (pathname.startsWith('/products/category/')) {
    const catSlug = pathname.replace('/products/category/', '').split('/')[0];
    pathname = '/products.html';
    parsedUrl.search = '?category=' + encodeURIComponent(catSlug);
    console.log('[Rewrite] /products/category/' + catSlug + ' →', pathname, parsedUrl.search);
  }
  // ── Case Studies 路由重写（必须在 /products/ 之前检查）───────────
  else if (pathname === '/case-studies' || pathname === '/cases') {
    pathname = '/case-studies.html';
    console.log('[Rewrite] [Case] /case-studies 或 /cases →', pathname);
  } else if (pathname.startsWith('/cases/') || pathname.startsWith('/case-studies/')) {
    const isCasesPrefix = pathname.startsWith('/cases/');
    const slug = isCasesPrefix ? pathname.replace('/cases/', '').split('/')[0] : pathname.replace('/case-studies/', '').split('/')[0];
    console.log('[Rewrite] [Case] 检测到案例详情路径:', pathname);
    console.log('[Rewrite] [Case] 前缀类型:', isCasesPrefix ? '/cases/' : '/case-studies/');
    console.log('[Rewrite] [Case] 提取的 slug:', slug);
    console.log('[Rewrite] [Case] slug 是否为空:', !slug || slug.trim() === '');
    pathname = '/case-detail.html';
    parsedUrl.search = '?slug=' + encodeURIComponent(slug);
    console.log('[Rewrite] [Case] 重写结果:', pathname + parsedUrl.search);
  }
  // /products/:slug → product-detail.html?slug=:slug
  else if (pathname.startsWith('/products/')) {
    const slug = pathname.replace('/products/', '').split('/')[0];
    pathname = '/product-detail.html';
    parsedUrl.search = '?slug=' + encodeURIComponent(slug);
    console.log('[Rewrite] /products/' + slug + ' →', pathname, parsedUrl.search);
  }
  // ── 其他路由重写 ────────────────────────────────────
  else if (pathname === '/about') {
    pathname = '/about.html';
  } else if (pathname === '/contact') {
    pathname = '/contact.html';
  } else if (pathname === '/applications') {
    pathname = '/applications.html';
  } else if (pathname === '/news') {
    pathname = '/news.html';
  } else if (pathname.startsWith('/news/')) {
    pathname = '/news-detail.html';
  }
  console.log('[Rewrite] Final pathname:', pathname, 'search:', parsedUrl.search);

  // 浏览量统计（仅统计真实访客，排除本地 IP）
  if (req.method === 'GET') {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isLocal  = ['127.0.0.1','::1','::ffff:127.0.0.1'].some(ip => clientIp.startsWith(ip));
    if (!isLocal) {
      // 如果是新闻详情页，从路径中获取 slug
      let slug = null;
      const origPathname = parsedUrl.pathname;
      if (origPathname.startsWith('/news/')) {
        slug = origPathname.replace('/news/', '').split('/')[0] || null;
      } else if (origPathname === '/news-detail.html') {
        const query = parsedUrl.query || '';
        const params = new URLSearchParams(query);
        slug = params.get('slug') || null;
      }
      recordPageview(pathname, slug, clientIp);
    }
  }

  // ── 路由重写完成日志 ──────────────────────────────
  console.log('[Rewrite] ─────────────────────────────────────────');
  console.log('[Rewrite] 最终路径:', pathname);
  console.log('[Rewrite] 最终查询:', parsedUrl.search || '(空)');
  console.log('[Rewrite] 重写耗时:', (Date.now() - startTime) + 'ms');
  console.log('[Rewrite] ===========================================');

  // 静态文件服务
  const filePath    = path.join(__dirname, pathname);
  const ext         = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // ── 产品/案例详情页 SSR 元信息注入 ──
  if (pathname === '/product-detail.html' || pathname === '/case-detail.html') {
    let _slug = '';
    if (originalPathname.startsWith('/products/')) {
      _slug = originalPathname.replace('/products/', '').split('/')[0];
    } else if (originalPathname.startsWith('/cases/')) {
      _slug = originalPathname.replace('/cases/', '').split('/')[0];
    } else if (originalPathname.startsWith('/case-studies/')) {
      _slug = originalPathname.replace('/case-studies/', '').split('/')[0];
    } else {
      const _params = new URLSearchParams((parsedUrl.search || '').replace(/^\?/, ''));
      _slug = (_params.get('slug') || '').trim();
    }
    return serveDetailWithMeta(req, res, { pathname, filePath, contentType, slug: _slug });
  }

  console.log('[File] 尝试读取文件:', filePath);
  console.log('[File] 文件扩展名:', ext);
  console.log('[File] 内容类型:', contentType);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log('[File] 文件读取错误:', err.code, '-', err.message);
      // ========== 临时注释 SPA Fallback，用于排查问题 ==========
      // SPA Fallback 可能导致错误时跳转到首页，暂时禁用以查看真实错误
      // if (err.code === 'ENOENT' && !pathname.startsWith('/api/') && !pathname.startsWith('/uploads/')) {
      //   console.log('[Fallback] 文件不存在，触发 SPA Fallback 返回 index.html');
      //   console.log('[Fallback] 原始请求路径:', originalPathname);
      //   console.log('[Fallback] 重写后路径:', pathname);
      //   const indexFile = path.join(__dirname, 'index.html');
      //   fs.readFile(indexFile, (err2, data2) => {
      //     if (err2) {
      //       console.log('[Fallback] index.html 读取失败:', err2.message);
      //       res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      //       res.end('<h1>404 Not Found</h1>');
      //       return;
      //     }
      //     res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      //     res.end(data2);
      //   });
      //   return;
      // }
      // ========== 临时注释结束 ==========
      
      // 返回简洁 404 页面（不暴露文件路径和错误详情，防信息泄露）
      console.log('[File] 返回 404:', filePath);
      console.log('[File] 原始路径:', originalPathname);
      console.log('[File] 错误详情:', err);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 - Page Not Found</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:50px;}h1{font-size:48px;color:#333;}p{color:#666;}a{color:#0066cc;text-decoration:none;}</style></head><body><h1>404</h1><p>The page you are looking for does not exist.</p><p><a href="/">Return to homepage</a></p></body></html>');
      return;
    }
    console.log('[File] 文件读取成功，大小:', data.length, 'bytes');
    const headers = { 'Content-Type': contentType };
    // 缓存策略：HTML 始终重新验证以保证内容更新立即可见；其余静态资源短期缓存以兼顾性能
    if (ext === '.html') {
      // HTML 始终禁止浏览器缓存，确保后台/CMS 编辑后立即可见
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else {
      headers['Cache-Control'] = 'public, max-age=300, must-revalidate';
    }
    // 若为 HTML，按后台配置注入 heroTitle / heroBg / contactImage，避免写死与 FOUC
    let out = data;
    if (ext === '.html') {
      let s = data.toString();
      let changed = false;
      if (s.includes('id="heroTitle"')) {
        const newInner = readHeroTitleHtml();
        if (newInner !== '') {
          s = s.replace(/<h1 id="heroTitle">[\s\S]*?<\/h1>/, '<h1 id="heroTitle">' + newInner + '</h1>');
          changed = true;
        }
      }
      // 注入 Hero 背景图（首屏即正确，不闪写死的旧图）
      if (s.includes('id="heroBgImage"') || s.includes('rel="preload" as="image"')) {
        const bg = readHeroBgUrl();
        if (bg) {
          const safe = bg.replace(/"/g, '&quot;');
          s = s.replace(/<img id="heroBgImage"[^>]*src="[^"]*"/, '<img id="heroBgImage" src="' + safe + '"');
          s = s.replace(/<link rel="preload" as="image" href="[^"]*"/, '<link rel="preload" as="image" href="' + safe + '"');
          changed = true;
        }
      }
      if (s.includes('id="contactImages"')) {
        const imgs = readContactImages();
        if (imgs.length > 0) {
          // 单张大图（如联系方式卡合图）全宽居中展示；多图保持小图 flex 排列
          if (imgs.length === 1) {
            const safe = imgs[0].replace(/"/g, '&quot;');
            const single = '<img src="' + safe + '" alt="联系方式" style="width:100%;max-width:800px;height:auto;border-radius:16px;display:block;margin:0 auto;object-fit:contain;">';
            s = s.replace(/<div id="contactImageWrap"[^>]*>/, '<div id="contactImageWrap" style="display:block;text-align:center;margin:0 auto 32px auto;max-width:800px;padding:0;background:transparent;border-radius:0;box-shadow:none;border:none;">');
            s = s.replace(/<div id="contactImages"[^>]*>/, '<div id="contactImages" style="display:block;">' + single + '</div>');
          } else {
            const items = imgs.map((u) => {
              const safe = u.replace(/"/g, '&quot;');
              return '<div style="flex:0 0 160px;max-width:180px;"><img src="' + safe + '" alt="联系方式" style="width:100%;height:auto;border-radius:12px;display:block;object-fit:contain;"></div>';
            }).join('');
            s = s.replace(/<div id="contactImageWrap"[^>]*>/, '<div id="contactImageWrap" style="display:block;text-align:center;margin:0 auto 32px auto;max-width:800px;padding:16px;background:#fff;border-radius:var(--radius-xl);box-shadow:var(--shadow-md);border:1px solid var(--gray-200);">');
            s = s.replace(/<div id="contactImages"[^>]*>/, '<div id="contactImages" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:flex-start;">' + items + '</div>');
          }
          changed = true;
        }
      }
      if (changed) out = Buffer.from(s, 'utf8');
    }
    res.writeHead(200, headers);
    res.end(out);
  });
});

server.listen(PORT, () => {
  const adminUrl = `${ADMIN_PROTO}://${ADMIN_HOST}:${ADMIN_PORT}`;
  console.log(`✅ JinYu 前台已启动: http://localhost:${PORT}/`);
  console.log(`   后台代理目标: ${adminUrl}`);
});
