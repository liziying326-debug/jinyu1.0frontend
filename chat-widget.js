/* =====================================================================
 * Tawk.to 在线客服聊天组件（全站共享）
 * ---------------------------------------------------------------------
 * Property ID : 6a5455c48cca241d4a6f938e
 * Widget ID   : 1jtcmu2fb
 * 说明        :
 *   - 聊天窗口语言跟随站点当前语言 (en / zh / tl / vi)。
 *   - 站点语言保存在 localStorage.jinyu_lang 与 window.i18n.currentLang。
 *   - 加载完成后隐藏默认的 Tawk.to 浮动按钮，由自定义的 Chat Menu 触发。
 *   - 暴露 window.openJinyuLiveChat() 供 chat-menu.js 调用。
 * ===================================================================== */
(function () {
  // Tawk.to 支持的语言码（我们用到的是 en/zh/tl/vi）
  var SUPPORTED = ['en', 'zh', 'tl', 'vi', 'es', 'fr', 'de', 'ru', 'ar', 'ja', 'ko', 'pt', 'th', 'id'];
  var lang = 'en';

  try {
    var saved = localStorage.getItem('jinyu_lang');
    if (saved) lang = saved;
  } catch (e) {}

  if (window.i18n && window.i18n.currentLang) lang = window.i18n.currentLang;
  if (SUPPORTED.indexOf(lang) === -1) lang = 'en';

  // 必须在加载 Tawk.to 脚本之前设置语言
  var Tawk_API = (window.Tawk_API = window.Tawk_API || {});
  Tawk_API.lang = lang;
  var Tawk_LoadStart = new Date();

  // 隐藏 Tawk.to 默认浮动按钮的多种保险机制
  function tryHideTawk() {
    if (window.Tawk_API && window.Tawk_API.hideWidget) {
      try { window.Tawk_API.hideWidget(); } catch (e) {}
    }
  }

  // 控制自定义 Chat with us 按钮的显隐
  function hideJinyuChatMenu() {
    var root = document.getElementById('jinyu-chat-root');
    if (!root) return;
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';
    root.style.transform = 'translateY(20px)';
    root.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  }

  function showJinyuChatMenu() {
    var root = document.getElementById('jinyu-chat-root');
    if (!root) return;
    root.style.opacity = '';
    root.style.pointerEvents = '';
    root.style.transform = '';
    root.style.transition = '';
  }

  Tawk_API.onBeforeLoad = tryHideTawk;
  Tawk_API.onLoad = function () {
    tryHideTawk();
    showJinyuChatMenu();
  };

  // Tawk.to 聊天窗口打开时隐藏自定义 Chat with us 按钮，避免重叠
  Tawk_API.onChatMaximized = hideJinyuChatMenu;

  // 用户关闭或最小化 Tawk.to 聊天窗口后，再次隐藏默认浮动按钮并显示 Chat with us
  Tawk_API.onChatMinimized = function () {
    tryHideTawk();
    showJinyuChatMenu();
  };
  Tawk_API.onChatHidden = function () {
    tryHideTawk();
    showJinyuChatMenu();
  };
  Tawk_API.onChatEnded = function () {
    tryHideTawk();
    showJinyuChatMenu();
  };

  // 多次尝试隐藏，确保在 Tawk.to 完全初始化后生效
  var attempts = 0;
  var hideTimer = setInterval(function () {
    tryHideTawk();
    attempts++;
    if (attempts >= 12) clearInterval(hideTimer);
  }, 400);

  // 暴露给 Chat Menu 的打开入口
  window.openJinyuLiveChat = function () {
    if (window.Tawk_API) {
      try { window.Tawk_API.showWidget(); } catch (e) {}
      try { window.Tawk_API.maximize(); } catch (e) {}
    }
  };

  // CSS 兜底：隐藏 Tawk.to 最小化后的浮动气泡（不阻止聊天窗口最大化显示）
  try {
    var css = document.createElement('style');
    css.textContent = '.tawk-min-chat-button, .tawk-card, .tawk-badge, .tawk-visitor-chat-bubble { display: none !important; }';
    document.head.appendChild(css);
  } catch (e) {}

  (function () {
    var s1 = document.createElement('script');
    var s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6a5455c48cca241d4a6f938e/1jtcmu2fb';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
  })();
})();
