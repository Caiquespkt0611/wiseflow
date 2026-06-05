export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/receitas/:path*", "/despesas-fixas/:path*", "/despesas-variaveis/:path*", "/projecao/:path*"],
};
