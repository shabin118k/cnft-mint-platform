import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const networkId = parseInt(searchParams.get('networkId') || '0')

    const isMainnet = networkId === 1
    const koiosUrl = isMainnet
      ? 'https://api.koios.rest/api/v1'
      : 'https://preprod.koios.rest/api/v1'

    const response = await fetch(`${koiosUrl}/tip`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Koios API error: ${response.statusText}`)
    }

    const data = await response.json()
    if (data && data.length > 0 && data[0].abs_slot) {
      const slot = parseInt(data[0].abs_slot)
      return NextResponse.json({ slot, networkId })
    }

    throw new Error('Invalid response from Koios API')
  } catch (error: any) {
    console.error('Koios API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch current slot from Koios' },
      { status: 500 }
    )
  }
}

