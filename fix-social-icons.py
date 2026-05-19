#!/usr/bin/env python3
import os
import re

files = [
    'case-detail.html',
    'case-studies.html', 
    'contact.html',
    'news-detail.html',
    'news.html',
    'product-detail.html',
    'products.html'
]

for filename in files:
    if not os.path.exists(filename):
        print(f'跳过 {filename}（不存在）')
        continue
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 旧格式：没有 DOMContentLoaded 包裹
    # 新格式：用 DOMContentLoaded 包裹
    old_pattern = r"// Social Icons \(动态加载\)\nif \(typeof loadSocialIcons === 'function'\) \{\n  loadSocialIcons\('#nav-social-icons', \{ maxCount: 3 \}\);\n  loadSocialIcons\('#footer-social-icons', \{ brandColor: true \}\);\n\}"
    
    new_code = """// Social Icons (动态加载)
// 确保在 api.js 加载完成后再执行
window.addEventListener('DOMContentLoaded', function() {
  if (typeof loadSocialIcons === 'function') {
    loadSocialIcons('#nav-social-icons', { maxCount: 3 });
    loadSocialIcons('#footer-social-icons', { brandColor: true });
  } else {
    console.warn('[Social Icons] loadSocialIcons function not found');
  }
});"""
    
    if "// Social Icons (动态加载)" in content and "DOMContentLoaded" not in content:
        # 需要修复
        content = content.replace("""// Social Icons (动态加载)
if (typeof loadSocialIcons === 'function') {
  loadSocialIcons('#nav-social-icons', { maxCount: 3 });
  loadSocialIcons('#footer-social-icons', { brandColor: true });
}""", new_code)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✅ 已修复 {filename}')
    else:
        print(f'⏭️  跳过 {filename}（已修复或格式不同）')

print('\n✅ 批量修复完成！')
