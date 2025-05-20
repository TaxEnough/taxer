import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
  service: 'gmail', // Gmail kullanımı (alternatif olarak SMTP yapılandırması da kullanılabilir)
  auth: {
    user: process.env.EMAIL_USER || 'support@taxenough.com', // Gönderen e-posta
    pass: process.env.EMAIL_PASSWORD, // E-posta şifresi (environment variable'dan)
  },
});

export async function POST(request: NextRequest) {
  try {
    // Form verisini al
    const formData = await request.json();
    
    if (!formData.name || !formData.email || !formData.message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // E-posta gönderme ayarları
    const mailOptions = {
      from: process.env.EMAIL_USER || 'support@taxenough.com',
      to: process.env.CONTACT_FORM_RECIPIENT || 'support@taxenough.com', // Alıcı e-posta
      subject: `Contact Form: ${formData.name}`,
      text: `
Name: ${formData.name}
Email: ${formData.email}

Message:
${formData.message}
      `,
      html: `
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${formData.name}</p>
<p><strong>Email:</strong> ${formData.email}</p>
<p><strong>Message:</strong></p>
<p>${formData.message.replace(/\n/g, '<br>')}</p>
      `,
      replyTo: formData.email, // Yanıt e-postasını doğrudan kullanıcıya gönder
    };
    
    try {
      // E-posta göndermeyi dene
      await transporter.sendMail(mailOptions);
      
      // Başarılı cevap dön
      return NextResponse.json({ success: true });
    } catch (emailError: any) {
      console.error('E-posta gönderme hatası:', emailError);
      
      // Eğer production ortamı değilse, e-posta gönderim hatası olsa bile başarılı sayalım
      if (process.env.NODE_ENV !== 'production') {
        console.log('Development mode: Continuing as if email was sent');
        return NextResponse.json({ success: true });
      }
      
      // Production ortamında hata dön
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Contact form API error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
} 
