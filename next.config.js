/** @type {import('next').NextConfig} */
const nextConfig = {
  // hapus/disable typedRoutes agar boleh pakai string dinamis
  // experimental: { typedRoutes: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' }
    ]
  }
};
module.exports = nextConfig;
