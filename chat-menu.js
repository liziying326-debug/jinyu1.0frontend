/* =====================================================================
 * Chat with us 多渠道聊天菜单（全站共享）
 * ---------------------------------------------------------------------
 * 说明：
 *   - 在页面右下角显示 "Chat with us" 浮动按钮。
 *   - 点击展开菜单，默认包含：Live Chat、WhatsApp、Telegram、WeChat、
 *     Zalo、LINE、Viber。
 *   - Live Chat 调用 Tawk.to（通过 chat-widget.js 暴露的函数）。
 *   - 菜单数据优先从后台 /api/chat-methods 读取，失败时使用本地默认配置。
 *   - 会隐藏页面原有的独立 WhatsApp 浮动按钮，避免重复。
 * ===================================================================== */
(function () {
  'use strict';

  // 本地默认配置（API 不可用时使用）
  var DEFAULT_CONFIG = [
    { key: 'live_chat', label: '', type: 'live', url: '', enabled: true, sort_order: 1 },
    { key: 'whatsapp', label: '', type: 'link', url: 'https://wa.me/8613928876522', enabled: true, sort_order: 2 },
    { key: 'telegram', label: '', type: 'link', url: '', enabled: true, sort_order: 3 },
    { key: 'wechat', label: '', type: 'link', url: '', enabled: true, sort_order: 4 },
    { key: 'zalo', label: '', type: 'link', url: '', enabled: true, sort_order: 5 },
    { key: 'line', label: '', type: 'link', url: '', enabled: true, sort_order: 6 },
    { key: 'viber', label: '', type: 'link', url: '', enabled: true, sort_order: 7 }
  ];

  // 多语言文案（与站点语言保持一致：en / zh / tl / vi）
  var TEXTS = {
    en: {
      title: 'Chat with us',
      subtitle: 'Message us for price, customization, and lead time.',
      live_chat: 'Live Chat',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
      wechat: 'WeChat',
      zalo: 'Zalo',
      line: 'LINE',
      viber: 'Viber',
      close: 'Close',
      comingSoon: 'Coming soon — please use WhatsApp or Live Chat for now.',
      wechatId: 'WeChat ID: ',
      scanQr: 'Scan to chat on'
    },
    zh: {
      title: '在线联系',
      subtitle: '如需价格、定制或交期，请随时联系我们。',
      live_chat: '在线聊天',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
      wechat: '微信',
      zalo: 'Zalo',
      line: 'LINE',
      viber: 'Viber',
      close: '关闭',
      comingSoon: '即将上线 — 暂时请使用 WhatsApp 或在线聊天。',
      wechatId: '微信号：',
      scanQr: '扫码添加'
    },
    tl: {
      title: 'Makipag-chat sa amin',
      subtitle: 'Makipag-ugnayan para sa presyo, customization, at lead time.',
      live_chat: 'Live Chat',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
      wechat: 'WeChat',
      zalo: 'Zalo',
      line: 'LINE',
      viber: 'Viber',
      close: 'Isara',
      comingSoon: 'Malapit na — maaari lamang gamitin ang WhatsApp o Live Chat.',
      wechatId: 'WeChat ID: ',
      scanQr: 'I-scan para makipag-chat sa'
    },
    vi: {
      title: 'Chat với chúng tôi',
      subtitle: 'Liên hệ để nhận báo giá, tùy chỉnh và thởi gian giao hàng.',
      live_chat: 'Trò chuyện trực tuyến',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
      wechat: 'WeChat',
      zalo: 'Zalo',
      line: 'LINE',
      viber: 'Viber',
      close: 'Đóng',
      comingSoon: 'Sắp ra mắt — vui lòng sử dụng WhatsApp hoặc Trò chuyện trực tuyến.',
      wechatId: 'ID WeChat: ',
      scanQr: 'Quét để trò chuyện trên'
    }
  };

  var lang = 'en';
  try {
    var saved = localStorage.getItem('jinyu_lang');
    if (saved) lang = saved;
  } catch (e) {}
  if (window.i18n && window.i18n.currentLang) lang = window.i18n.currentLang;
  if (!TEXTS[lang]) lang = 'en';
  var t = TEXTS[lang];

  // 隐藏页面原有的独立 WhatsApp 浮动按钮（已整合进 Chat with us 菜单，避免重复）
  try {
    var style = document.createElement('style');
    style.textContent = '.fab-wa { display: none !important; }';
    document.head.appendChild(style);
  } catch (e) {}

  function getLabel(method) {
    if (method.label) return method.label;
    return t[method.key] || method.key;
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildMenu(methods) {
    // 过滤并排序
    var activeMethods = methods
      .filter(function (m) { return m.enabled !== false && m.enabled !== 0; })
      .sort(function (a, b) {
        return (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0);
      });

    // ==================== 构建 UI ====================
    var slot = document.getElementById('jinyu-chat-slot');
    var root = document.createElement('div');
    root.id = 'jinyu-chat-root';
    if (slot) root.className = 'jinyu-chat-in-slot';
    root.innerHTML =
      '<button id="jinyu-chat-trigger" type="button" aria-label="' + t.title + '">' +
        '<span class="jinyu-chat-trigger-text">' + t.title + '</span>' +
      '</button>' +
      '<div id="jinyu-chat-panel" class="jinyu-chat-hidden" role="dialog" aria-hidden="true">' +
        '<div class="jinyu-chat-header">' +
          '<span class="jinyu-chat-title">' + t.title + '</span>' +
          '<button type="button" class="jinyu-chat-close" aria-label="' + t.close + '">×</button>' +
        '</div>' +
        '<div class="jinyu-chat-body">' +
          '<p class="jinyu-chat-subtitle">' + t.subtitle + '</p>' +
          '<div class="jinyu-chat-options-wrap">' +
            '<button type="button" class="jinyu-chat-scroll jinyu-chat-scroll-up jinyu-chat-hidden" aria-label="Scroll up">&#9650;</button>' +
            '<div class="jinyu-chat-options"></div>' +
            '<button type="button" class="jinyu-chat-scroll jinyu-chat-scroll-down jinyu-chat-hidden" aria-label="Scroll down">&#9660;</button>' +
          '</div>' +
          '<div class="jinyu-chat-notice jinyu-chat-hidden"></div>' +
        '</div>' +
      '</div>';
    if (slot) {
      slot.appendChild(root);
    } else {
      document.body.appendChild(root);
      ensureRootOnTop();
    }

    var trigger = document.getElementById('jinyu-chat-trigger');
    var panel = document.getElementById('jinyu-chat-panel');
    var closeBtn = panel.querySelector('.jinyu-chat-close');
    var optionsBox = panel.querySelector('.jinyu-chat-options');
    var optionsWrap = panel.querySelector('.jinyu-chat-options-wrap');
    var scrollUpBtn = panel.querySelector('.jinyu-chat-scroll-up');
    var scrollDownBtn = panel.querySelector('.jinyu-chat-scroll-down');
    var noticeBox = panel.querySelector('.jinyu-chat-notice');

    // 确保聊天菜单始终位于 body 最末尾，从而覆盖 Tawk.to 等后注入的 iframe
    // （若已嵌入 fab-container 的 slot 中，则不需要再移动到 body 末尾）
    function ensureRootOnTop() {
      if (slot || !root || !document.body || document.body.lastElementChild === root) return;
      document.body.appendChild(root);
    }

    function updateScrollButtons() {
      if (!optionsBox || !scrollUpBtn || !scrollDownBtn) return;
      var canScrollUp = optionsBox.scrollTop > 4;
      var canScrollDown = optionsBox.scrollTop + optionsBox.clientHeight < optionsBox.scrollHeight - 4;
      scrollUpBtn.classList.toggle('jinyu-chat-hidden', !canScrollUp);
      scrollDownBtn.classList.toggle('jinyu-chat-hidden', !canScrollDown);
    }

    function scrollOptionsBy(delta) {
      if (!optionsBox) return;
      optionsBox.scrollBy({ top: delta, behavior: 'smooth' });
      setTimeout(updateScrollButtons, 160);
    }

    activeMethods.forEach(function (method) {
      var url = method.url || '';
      var type = method.type || 'link';
      var label = getLabel(method);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jinyu-chat-option';
      btn.innerHTML = '<span class="jinyu-chat-option-label">' + label + '</span>';

      if (type === 'live') {
        btn.addEventListener('click', function () {
          if (window.openJinyuLiveChat) {
            window.openJinyuLiveChat();
          } else {
            showNotice(t.comingSoon);
          }
          closePanel();
        });
      } else if (type === 'wechat') {
        btn.addEventListener('click', function () {
          if (url) {
            if (url.indexOf('http') === 0) {
              window.open(url, '_blank');
            } else {
              showNotice(t.wechatId + url);
            }
          } else {
            showNotice(t.comingSoon);
          }
        });
      } else {
        btn.addEventListener('click', function () {
          if (url) {
            // 如果 url 是图片，弹出二维码/图片灯箱；否则跳转链接
            if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)) {
              closePanel();
              showImageLightbox(url, t.scanQr + ' ' + label);
            } else {
              window.open(url, '_blank');
            }
          } else {
            showNotice(t.comingSoon);
          }
        });
      }

      optionsBox.appendChild(btn);
    });

    // 上下滚动按钮事件
    if (scrollUpBtn) {
      scrollUpBtn.addEventListener('click', function () { scrollOptionsBy(-56); });
    }
    if (scrollDownBtn) {
      scrollDownBtn.addEventListener('click', function () { scrollOptionsBy(56); });
    }
    if (optionsBox) {
      optionsBox.addEventListener('scroll', updateScrollButtons);
    }
    // 初始检测是否需要滚动按钮
    setTimeout(updateScrollButtons, 0);
    window.addEventListener('resize', updateScrollButtons);

    function showNotice(text) {
      noticeBox.textContent = text;
      noticeBox.classList.remove('jinyu-chat-hidden');
      setTimeout(function () {
        noticeBox.classList.add('jinyu-chat-hidden');
      }, 4000);
    }

    function showImageLightbox(src, title) {
      var overlay = document.createElement('div');
      overlay.className = 'jinyu-qr-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML =
        '<div class="jinyu-qr-backdrop"></div>' +
        '<div class="jinyu-qr-card">' +
          '<button type="button" class="jinyu-qr-close" aria-label="' + t.close + '">×</button>' +
          (title ? '<p class="jinyu-qr-title">' + escHtml(title) + '</p>' : '') +
          '<img src="' + escHtml(src) + '" alt="QR Code" class="jinyu-qr-image">' +
        '</div>';
      document.body.appendChild(overlay);

      function closeLightbox() {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.removeEventListener('keydown', onKeyDown);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') closeLightbox();
      }

      overlay.querySelector('.jinyu-qr-close').addEventListener('click', closeLightbox);
      overlay.querySelector('.jinyu-qr-backdrop').addEventListener('click', closeLightbox);
      document.addEventListener('keydown', onKeyDown);
    }

    function openPanel() {
      ensureRootOnTop();
      panel.classList.remove('jinyu-chat-hidden');
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      setTimeout(updateScrollButtons, 50);
      setTimeout(updateScrollButtons, 200);
    }

    function closePanel() {
      panel.classList.add('jinyu-chat-hidden');
      panel.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', function () {
      if (panel.classList.contains('jinyu-chat-hidden')) {
        openPanel();
      } else {
        closePanel();
      }
    });

    closeBtn.addEventListener('click', closePanel);

    // 点击面板外部关闭
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) {
        closePanel();
      }
    });
  }

  // 尝试从后台读取聊天方式配置
  function loadConfig() {
    // 先以本地默认配置兜底显示，避免等待 API 时按钮不渲染
    var fallbackMethods = DEFAULT_CONFIG.map(function (m) {
      return { ...m, label: getLabel(m) };
    });

    if (typeof fetch !== 'function') {
      buildMenu(fallbackMethods);
      return;
    }

    fetch('/api/chat-methods')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var data = Array.isArray(json) ? json : (json && json.data ? json.data : []);
        if (data && data.length > 0) {
          buildMenu(data);
        } else {
          buildMenu(fallbackMethods);
        }
      })
      .catch(function (err) {
        console.warn('[chat-menu] 加载后台聊天方式失败，使用默认配置:', err);
        buildMenu(fallbackMethods);
      });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadConfig);
  } else {
    loadConfig();
  }
})();
