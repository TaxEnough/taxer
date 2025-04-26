import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <a href="/">
              <img
                src="/images/onetext.png"
                alt="OneText"
                width={200}
                height={50}
                className="h-auto cursor-pointer"
              />
            </a>
          </div>
          <p className="text-gray-600">
            Tax calculation, investment tracking and financial planning tools.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
} 