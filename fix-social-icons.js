const fs = require('fs');
const path = require('path');

const files = [
  'about.html',
  'applications.html',
  'case-detail.html',
  'case-studies.html',
  'contact.html',
  'news-detail.html',
  'news.html',
  'product-detail.html',
  'products.html'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`跳过 ${file}（不存在）`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // 替换旧的调用方式
  const oldPattern = /\/\/ ── 社交媒体图标（从后台动态加载） ──\nif \(typeof loadSocialIcons === 'function'\) \{\n  loadSocialIcons\('#nav-social-icons', \{ maxCount: 3 \}\);[\s\S]*?loadSocialIcons\('#footer-social-icons', \{ brandColor: true \}\);\n\}/;
  
  const newCode = `// ── 社交媒体图标（从后台动态加载） ──
// 确保在 api.js 加载完成后再执行
window.addEventListener('DOMContentLoaded', function() {
  if (typeof loadSocialIcons === 'function') {
    loadSocialIcons('#nav-social-icons', { maxCount: 3 });
    loadSocialIcons('#footer-social-icons', { brandColor: true });
  } else {
    console.warn('[Social Icons] loadSocialIcons function not found');
  }
});`;

  const newContent = content.replace(oldPattern, newCode);
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ 已修复 ${file}`);
  } else {
    console.log(`⚠️  ${file} 未找到匹配内容（可能已修复或格式不同）`);
  }
});

console.log('\n✅ 批量修复完成！');
