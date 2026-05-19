/**
 * 公共 FAQ 加载器
 * 用于 products、applications、case-studies、news 等页面
 */

var faqCache = [];
var faqLoadLang = '';

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadFaqs() {
  if (faqCache.length) {
    await renderFaqs(faqCache);
    return;
  }
  
  try {
    const res = await fetch('/api/faqs');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      faqCache = json.data;
      await renderFaqs(faqCache);
    }
  } catch(e) {
    console.error('[FAQ] Load failed:', e);
  }
}

async function renderFaqs(faqs) {
  const lang = (window.i18n && window.i18n.currentLang) || 'en';
  if (lang === faqLoadLang) return;
  faqLoadLang = lang;
  
  const tabs = ['products', 'ordering', 'shipping', 'quality'];
  const currentTab = tabs[0];
  
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const container = document.getElementById(tab + '-faq');
    if (!container) continue;
    
    const tabFaqs = faqs.filter(f => f.tab === tab);
    
    if (tabFaqs.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:14px;">No FAQs in this category</div>';
      continue;
    }
    
    let html = '';
    for (let j = 0; j < tabFaqs.length; j++) {
      const faq = tabFaqs[j];
      const question = faq['question_' + lang] || faq.question || '';
      const answer = faq['answer_' + lang] || faq.answer || '';
      const isFirst = (i === 0 && j === 0);
      
      html += `
        <div class="faq-item${isFirst ? ' expanded' : ''}" data-faq-id="${faq.id}">
          <div class="faq-question">
            <span>${escapeHtml(question)}</span>
            <svg class="faq-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
          <div class="faq-answer${isFirst ? ' show' : ''}">
            <span>${escapeHtml(answer)}</span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }
  
  initFaqTabs();
  initFaqItems();
}

function initFaqTabs() {
  const tabsContainer = document.getElementById('faq-tabs-container');
  if (!tabsContainer) return;
  
  const tabs = tabsContainer.querySelectorAll('.faq-tab');
  const contents = document.querySelectorAll('#faq-content-container .faq-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      contents.forEach(content => {
        content.classList.toggle('show', content.id === tabName + '-faq');
      });
    });
  });
}

function initFaqItems() {
  const questions = document.querySelectorAll('#faq-content-container .faq-question');
  questions.forEach(function(question) {
    question.addEventListener('click', function() {
      const faqItem = this.parentElement;
      const answer = faqItem.querySelector('.faq-answer');
      
      if (answer) {
        answer.classList.toggle('show');
        faqItem.classList.toggle('expanded');
      }
    });
  });
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(loadFaqs, 500);
  });
} else {
  setTimeout(loadFaqs, 500);
}

// 语言切换时重新加载
document.addEventListener('langChange', function() {
  faqLoadLang = '';
  loadFaqs();
});
