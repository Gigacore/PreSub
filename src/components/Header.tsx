function Header() {
  return (
    <header className="text-center mb-8 sm:mb-10">
      <h1 className="tracking-tight">
        <img
          src={import.meta.env.BASE_URL + 'assets/presub-logo.png'}
          alt="PreSub logo"
          className="mx-auto h-20 sm:h-24 md:h-28 lg:h-32 w-auto"
          loading="eager"
          decoding="async"
        />
      </h1>
      <p className="text-base sm:text-lg mt-2 text-gray-600 max-w-2xl mx-auto px-2">
        Scan your documents securely in the browser—no data leaves your device.
      </p>
    </header>
  );
}

export default Header;
