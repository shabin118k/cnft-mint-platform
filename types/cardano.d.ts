// Cardanoウォレットの型定義

interface CardanoWallet {
  enable(): Promise<CardanoWalletAPI>
  isEnabled(): Promise<boolean>
  apiVersion: string
  icon: string
  name: string
}

interface CardanoWalletAPI {
  getNetworkId(): Promise<number>
  getUtxos(amount?: string, paginate?: Paginate): Promise<string[]>
  getBalance(): Promise<string>
  getUsedAddresses(paginate?: Paginate): Promise<string[]>
  getUnusedAddresses(): Promise<string[]>
  getChangeAddress(): Promise<string>
  getRewardAddresses(): Promise<string[]>
  signTx(tx: string, partialSign?: boolean): Promise<string>
  signData(address: string, payload: string): Promise<DataSignature>
  submitTx(tx: string): Promise<string>
  getCollateral(params?: { amount?: string }): Promise<string[]>
  experimental?: {
    [key: string]: any
  }
}

interface Paginate {
  page?: number
  limit?: number
}

interface DataSignature {
  signature: string
  key: string
}

interface Window {
  cardano?: {
    [walletName: string]: CardanoWallet
  }
}

