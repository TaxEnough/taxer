const fs = require('fs');
const path = require('path');

// Silinecek içerikler
const importPattern = /import\s+Footer\s+from\s+['"]@\/components\/Footer['"];\s*\n/;
const footerPattern = /<Footer\s*\/>\s*\n/;

// Taranacak dizin
const appDir = path.join(__dirname, '..', 'src', 'app');

// Dosyaları işleyecek fonksiyon
function processFile(filePath) {
  try {
    // Dosyayı oku
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Footer importunu ve kullanımını kaldır
    const oldContent = content;
    content = content.replace(importPattern, '');
    content = content.replace(footerPattern, '');
    
    // Değişiklik yapıldıysa kaydet
    if (content !== oldContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Düzeltildi: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Hata: ${filePath} işlenemedi:`, error.message);
    return false;
  }
}

// Dizini rekursif olarak tara
function traverseDirectory(dir) {
  let fileCount = 0;
  let fixedCount = 0;
  
  function traverse(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const currentPath = path.join(currentDir, file);
      const stats = fs.statSync(currentPath);
      
      if (stats.isDirectory()) {
        traverse(currentPath);
      } else if (stats.isFile() && (file.endsWith('.tsx') || file.endsWith('.jsx'))) {
        fileCount++;
        if (processFile(currentPath)) {
          fixedCount++;
        }
      }
    }
  }
  
  traverse(dir);
  return { fileCount, fixedCount };
}

// Başla
console.log('Footer bileşenlerini kaldırma işlemi başlatılıyor...');
const { fileCount, fixedCount } = traverseDirectory(appDir);
console.log(`İşlem tamamlandı! Taranan dosya: ${fileCount}, Düzeltilen dosya: ${fixedCount}`); 