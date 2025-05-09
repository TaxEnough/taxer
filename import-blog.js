const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const slugify = require('slugify');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAMKxb62WpiWL1JZkRN8iMFFTwIkZp7bXo",
  authDomain: "taxapp-99346.firebaseapp.com",
  projectId: "taxapp-99346",
  storageBucket: "taxapp-99346.appspot.com",
  messagingSenderId: "508354164689",
  appId: "1:508354164689:web:888d6e5031ab93f2aed2f0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize HTML to Markdown converter
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

async function importBlogPost(filePath) {
  try {
    // Read the HTML file
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    
    // Extract metadata
    const title = $('title').text().split('|')[0].trim();
    const description = $('meta[name="description"]').attr('content');
    const slug = slugify(title, { 
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    // Extract content (excluding head and meta tags)
    const content = $('body').html();
    
    // Convert HTML to Markdown
    const markdown = turndownService.turndown(content);
    
    // Generate tags from content
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const potentialTags = title.toLowerCase()
      .split(/[\s\-\(\)]+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 5);
    
    // Prepare blog post data
    const blogPost = {
      title,
      summary: description || markdown.split('\n')[0],
      content: markdown,
      slug,
      author: 'TaxEnough',
      tags: potentialTags,
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'blogPosts'), blogPost);
    console.log('Blog post imported successfully:', docRef.id);
    console.log('Title:', title);
    console.log('Slug:', slug);
    console.log('Tags:', potentialTags);
    
    return docRef.id;
  } catch (error) {
    console.error('Error importing blog post:', error);
    throw error;
  }
}

// Check if file path is provided
const filePath = process.argv[2];
if (!filePath) {
  console.error('Please provide a file path: node import-blog.js path/to/blogpost.txt');
  process.exit(1);
}

// Import the blog post
importBlogPost(filePath)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 