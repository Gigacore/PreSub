function Header() {
  return (
    <header className="text-center mb-6 sm:mb-8 md:mb-10">
      <h1 className="tracking-tight">
        <img
          src={import.meta.env.BASE_URL + 'assets/presub-logo.png'}
          alt="PreSub logo"
          className="mx-auto max-w-full h-12 sm:h-16 md:h-20 lg:h-24 w-auto"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </h1>
      <p className="mt-3 sm:mt-4 text-gray-600 mx-auto max-w-2xl text-sm md:text-base lg:text-lg leading-relaxed">
        Detect and fix issues that lead to avoidable rejections. Saves time under submission pressure. Built for researchers to stay anonymous, compliant, and confident. 
        <span className="block text-xs sm:text-sm text-gray-700 mt-2">
          <span className="inline-flex font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V7.125A4.125 4.125 0 0 0 12.375 3 4.125 4.125 0 0 0 8.25 7.125V10.5m8.25 0H7.5m9 0a2.25 2.25 0 0 1 2.25 2.25v6A2.25 2.25 0 0 1 16.5 21H7.5A2.25 2.25 0 0 1 5.25 18.75v-6A2.25 2.25 0 0 1 7.5 10.5m9 0H7.5"
              />
            </svg>
            Privacy-first and secure — your data never leaves your device.
          </span>
        </span>
      </p>
    </header>
  );
}

export default Header;
