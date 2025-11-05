import { NextRequest, NextResponse } from 'next/server'
import { testKuboRPCConnection } from '@/lib/ipfs-server'

export async function POST(request: NextRequest) {
  try {
    // IPFS URLは環境変数からのみ取得（ユーザー入力なし）
    const ipfsUrl = process.env.IPFS_URL || 'http://localhost:5001'

    const result = await testKuboRPCConnection(ipfsUrl)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('IPFS接続テストAPIエラー:', error)
    return NextResponse.json(
      { 
        connected: false,
        error: error.message || '接続テストに失敗しました' 
      },
      { status: 500 }
    )
  }
}

