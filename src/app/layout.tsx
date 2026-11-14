import type { Metadata } from 'next';import './globals.css';import { SiteHeader,SiteFooter } from '@/components/site';import { TableOrderStatus } from '@/components/table-order-status';
export const metadata:Metadata={title:'Pizza Station 1800 — Menu & Orders',description:'Browse pizza, burgers, biryani, platters, drinks and more at Pizza Station 1800.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteHeader/><TableOrderStatus/>{children}<SiteFooter/></body></html>}
