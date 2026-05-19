#!/bin/bash
# 批量修复 loadSocialIcons 调用时机问题

files=(
  "about.html"
  "applications.html"
  "case-detail.html"
  "case-studies.html"
  "contact.html"
  "news-detail.html"
  "news.html"
  "product-detail.html"
  "products.html"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "修复 $file ..."
    sed -i '' 's/^\/\/ ── 社交媒体图标（从后台动态加载）───$/# ── 社交媒体图标（从后台动态加载）───\nwindow.addEventListener('\''DOMContentLoaded'\'', function() {/' "$file"
    sed -i '' 's/^if (typeof loadSocialIcons === .function.) {$/  if (typeof loadSocialIcons === '\''function'\'') {/' "$file"
    sed -i '' 's/^}$/  }\n});/' "$file"
  fi
done

echo "✅ 修复完成"
