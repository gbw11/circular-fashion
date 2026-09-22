import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAuthStore } from '../../../stores/authStore.ts'
import { ProcessingJobDetail } from './ProcessingJobDetail.tsx'

const mocks = vi.hoisted(() => ({
  useProcessingJob: vi.fn(),
  saveResult: vi.fn(),
  recognizeWeight: vi.fn(),
  uploadEvidence: vi.fn(),
}))

vi.mock('../../material/api/recognizeWeight.ts', () => ({
  recognizeWeight: mocks.recognizeWeight,
}))
vi.mock('../../evidence/api/uploadEvidence.ts', () => ({
  uploadEvidence: mocks.uploadEvidence,
}))

vi.mock('../hooks/useProcessingJobs.ts', () => ({
  useProcessingJob: mocks.useProcessingJob,
}))
vi.mock('../../evidence/components/EvidenceUpload.tsx', () => ({
  EvidenceUpload: ({ uploadMode }: { uploadMode?: string }) => (
    <div data-testid="evidence-upload" data-upload-mode={uploadMode}>증빙 업로드</div>
  ),
}))

const mutation = () => ({ isPending: false, error: null, mutate: vi.fn() })

function scalePhoto(name = 'scale.jpg'): File {
  return new File([new Uint8Array(4)], name, { type: 'image/jpeg' })
}

/** 저울 사진 한 장이 g 단위로 인식된 결과. */
const recognized = (value: number) => ({
  status: 'SUCCESS' as const,
  weight: { value, unit: 'g' as const },
  ocr: { rawText: `${value} g`, confidence: 0.97 },
  detection: { scaleConfidence: 0.96, displayConfidence: 0.95 },
  confidence: 0.95,
  message: null,
})

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scale-preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  mocks.recognizeWeight.mockReset()
  mocks.uploadEvidence.mockReset()
  mocks.uploadEvidence.mockResolvedValue([
    { evidenceFileId: 91, fileHash: '0xhash', evidenceType: 'AFTER_PHOTO' },
  ])
  useAuthStore.setState({
    user: { id: 8, email: 'processor@test.com', name: '가공사', role: 'PROCESSOR', walletAddress: null },
    accessToken: 'token',
    isAuthenticated: true,
  })
  mocks.useProcessingJob.mockReturnValue({
    detail: {
      isPending: false,
      isError: false,
      data: {
        jobId: 17,
        jobCode: 'JOB-017',
        requestId: 3,
        quoteId: 5,
        brandId: 2,
        processorId: 8,
        fee: 10_000,
        paymentAmount: 10_000,
        status: 'PROCESSING',
        paymentExpiresAt: '2026-09-15T10:15:00',
        createdAt: '2026-09-15T10:00:00',
        inputMaterialId: 11,
        inputQuantity: 1_000,
        lossQuantity: 0,
        resultRevision: 0,
        carrier: null,
        trackingNumber: null,
        rejectionReason: null,
        shippedAt: null,
        receivedAt: null,
        startedAt: '2026-09-15T10:00:00',
        resultSubmittedAt: null,
        rejectedAt: null,
        completedAt: null,
        outputs: [],
      },
      refetch: vi.fn(),
    },
    request: {
      isPending: false,
      isError: false,
      data: {
        requestId: 3,
        requestCode: 'PR-003',
        brandId: 2,
        brandName: '새로이 브랜드',
        processorId: 8,
        processorName: '가공사',
        materialId: 11,
        materialCode: 'MAT-011',
        materialName: '폐데님 원단',
        materialType: 'DENIM',
        quantity: 1_000,
        processTypes: ['CLEANING', 'CUTTING'],
        status: 'SELECTED',
        createdAt: '2026-09-15T09:00:00',
        expiresAt: '2026-09-22T09:00:00',
      },
    },
    ship: mutation(),
    receive: mutation(),
    start: mutation(),
    saveResult: { ...mutation(), mutate: mocks.saveResult },
    submit: mutation(),
    approve: mutation(),
    reject: mutation(),
  })
})

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  vi.clearAllMocks()
})

test('산출 수량이 바뀌면 Loss를 즉시 계산하고 투입량 초과 시 저장을 막는다', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  expect(screen.getByLabelText('산출 수량 합계')).toHaveTextContent('0 g')
  expect(screen.getByLabelText('자동 계산 Loss')).toHaveTextContent('1,000 g')

  await user.type(screen.getByLabelText('산출물 1 소재명'), '재생 원단')
  await user.type(screen.getByLabelText('산출물 1 등급 판정 사유'), '오염과 손상이 없음')
  await user.type(screen.getByLabelText('산출물 1 산출 수량(g)'), '650')
  expect(screen.getByLabelText('산출 수량 합계')).toHaveTextContent('650 g')
  expect(screen.getByLabelText('자동 계산 Loss')).toHaveTextContent('350 g')
  expect(screen.getByRole('button', { name: '결과 임시 저장' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: '산출물 추가' }))
  await user.type(screen.getAllByLabelText(/소재명/)[1], '재생 부자재')
  await user.type(screen.getByLabelText('산출물 2 등급 판정 사유'), '오염과 손상이 없음')
  await user.type(screen.getByLabelText('산출물 2 산출 수량(g)'), '500')

  expect(screen.getByLabelText('산출 수량 합계')).toHaveTextContent('1,150 g')
  expect(screen.getByLabelText('자동 계산 Loss')).toHaveTextContent('0 g')
  expect(screen.getByRole('alert')).toHaveTextContent('투입량을 150 g 초과했습니다.')
  expect(screen.getByRole('button', { name: '결과 임시 저장' })).toBeDisabled()
})

test('가공 증빙은 종류별 업로드 모드로 표시한다', () => {
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  expect(screen.getByTestId('evidence-upload')).toHaveAttribute('data-upload-mode', 'type-grid')
})
test('Processor에게 기술 ID 대신 요청 대상과 공정 정보를 보여준다', () => {
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '폐데님 원단 가공' })).toBeInTheDocument()
  expect(screen.getByText('새로이 브랜드')).toBeInTheDocument()
  expect(screen.getByText('MAT-011')).toBeInTheDocument()
  expect(screen.getByText('세척')).toBeInTheDocument()
  expect(screen.getByText('재단')).toBeInTheDocument()
  expect(screen.queryByText('JOB-017')).not.toBeInTheDocument()
  expect(screen.queryByText('PROCESSING JOB')).not.toBeInTheDocument()
})

test('산출물 입력 의미를 라벨로 안내하고 선택한 등급과 판정 사유를 저장한다', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  expect(screen.getByLabelText('산출물 1 소재 종류')).toBeInTheDocument()
  await user.type(screen.getByLabelText('산출물 1 소재명'), '재생 데님 원단')
  await user.selectOptions(screen.getByLabelText('산출물 1 품질 등급'), 'B')
  await user.type(screen.getByLabelText('산출물 1 등급 판정 사유'), '표면에 경미한 오염이 남아 있음')
  await user.type(screen.getByLabelText('산출물 1 산출 수량(g)'), '650')
  await user.click(screen.getByRole('button', { name: '결과 임시 저장' }))

  expect(mocks.saveResult).toHaveBeenCalledWith({
    outputs: [{
      name: '재생 데님 원단',
      grade: 'B',
      gradeReason: '표면에 경미한 오염이 남아 있음',
      quantity: 650,
    }],
  })
})

/*
  산출물의 소재 종류는 가공사가 고를 값이 아니다 — 데님을 맡겼는데 면사가 나올 수는 없다.
  가공은 섬유를 정제하고 모양을 바꿀 뿐 종류를 바꾸지 않는다. 화면은 투입 소재의 종류를
  보여 주기만 하고 보내지 않는다. 서버가 투입 소재에서 파생하므로 보낼 이유도 없다.
*/
test('산출 소재 종류는 투입 소재를 그대로 따르고 고를 수 없다', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  const shown = screen.getByLabelText('산출물 1 소재 종류')
  expect(shown).toHaveTextContent('데님')
  expect(shown.tagName).not.toBe('SELECT')

  await user.type(screen.getByLabelText('산출물 1 소재명'), '재생 데님 원단')
  await user.type(screen.getByLabelText('산출물 1 등급 판정 사유'), '오염과 손상이 없음')
  await user.type(screen.getByLabelText('산출물 1 산출 수량(g)'), '650')
  await user.click(screen.getByRole('button', { name: '결과 임시 저장' }))

  const [payload] = mocks.saveResult.mock.calls[0]
  expect(payload.outputs[0]).not.toHaveProperty('materialType')
})
test('반환 발송 폼을 작업 카드 안에 중첩 카드 없이 표시한다', () => {
  const flow = mocks.useProcessingJob()
  mocks.useProcessingJob.mockReturnValue({
    ...flow,
    detail: { ...flow.detail, data: { ...flow.detail.data, status: 'RESULT_SUBMITTED' } },
    evidence: { data: { files: [] } },
    shipReturn: mutation(),
    returnRejected: mutation(),
  })

  const { container } = render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '가공 결과물 반환 발송' })).toBeInTheDocument()
  expect(container.querySelector('.pj-panel .pj-panel')).not.toBeInTheDocument()
  expect(container.querySelector('.pj-panel .pj-shipment-form')).toBeInTheDocument()
})

/*
  소재 등록에만 있던 저울 사진 인식을 가공 결과 입력에도 쓴다. 산출물이 여러 행일 수
  있으므로, 인식한 무게가 사진을 올린 그 행에만 들어가야 한다 — 다른 행에 새면
  가공사가 눈치채지 못한 채 잘못된 산출량이 온체인까지 간다.
*/
test('가공 후 저울 사진 인식 무게는 사진을 올린 산출물 행에만 들어간다', async () => {
  mocks.recognizeWeight.mockResolvedValue(recognized(650))
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  await user.click(screen.getByRole('button', { name: '산출물 추가' }))
  await user.upload(screen.getByLabelText('산출물 2 가공 후 저울 사진'), scalePhoto())
  await screen.findByText('650 g')
  await user.click(screen.getByRole('button', { name: '인식 무게 적용' }))

  expect(screen.getByLabelText('산출물 2 산출 수량(g)')).toHaveValue(650)
  expect(screen.getByLabelText('산출물 1 산출 수량(g)')).toHaveValue(null)
})

/*
  가공 전 무게는 채울 칸이 없다 — 투입 수량은 브랜드가 보낸 값이라 가공사가 고칠 수 없다.
  그래도 읽어 주는 이유는, 받은 물건이 보낸 양과 다르면 그 사실이 가공을 시작하기 전에
  드러나야 하기 때문이다. 나중에 Loss 로 뭉뚱그려지면 어디서 줄었는지 알 수 없다.
*/
test('가공 전 저울 사진이 투입 수량과 다르면 차이를 경고한다', async () => {
  mocks.recognizeWeight.mockResolvedValue(recognized(940))
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  await user.upload(screen.getByLabelText('가공 전 저울 사진'), scalePhoto())
  await user.click(await screen.findByRole('button', { name: '투입 수량과 대조' }))

  // 투입 수량은 1,000 g 이다.
  expect(screen.getByRole('alert')).toHaveTextContent('투입 수량 1,000 g 보다 60 g 적습니다')
})

test('가공 전 저울 사진이 투입 수량과 같으면 경고하지 않는다', async () => {
  mocks.recognizeWeight.mockResolvedValue(recognized(1_000))
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  await user.upload(screen.getByLabelText('가공 전 저울 사진'), scalePhoto())
  await user.click(await screen.findByRole('button', { name: '투입 수량과 대조' }))

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

/*
  증빙은 소프트 삭제라(EvidenceDeletionService) 한 번 올라간 파일은 기록에서 사라지지
  않는다. 그래서 저장을 다시 눌렀을 때 같은 사진이 또 올라가면 안 된다 — 가공사가
  "저장이 안 된 것 같아서" 한 번 더 누르는 일은 흔하다.
*/
test('결과 임시 저장이 저울 사진을 증빙으로 올린 뒤 저장하고, 다시 눌러도 또 올리지 않는다', async () => {
  mocks.recognizeWeight.mockResolvedValue(recognized(650))
  mocks.uploadEvidence
    .mockResolvedValueOnce([{ evidenceFileId: 91, fileHash: '0xa', evidenceType: 'BEFORE_PHOTO' }])
    .mockResolvedValueOnce([{ evidenceFileId: 92, fileHash: '0xb', evidenceType: 'AFTER_PHOTO' }])
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  await user.type(screen.getByLabelText('산출물 1 소재명'), '재생 데님 원단')
  await user.type(screen.getByLabelText('산출물 1 등급 판정 사유'), '오염과 손상이 없음')
  await user.upload(screen.getByLabelText('가공 전 저울 사진'), scalePhoto('before.jpg'))
  await user.upload(screen.getByLabelText('산출물 1 가공 후 저울 사진'), scalePhoto('after.jpg'))
  await user.click(await screen.findByRole('button', { name: '인식 무게 적용' }))
  expect(screen.getByLabelText('산출물 1 산출 수량(g)')).toHaveValue(650)

  await user.click(screen.getByRole('button', { name: '결과 임시 저장' }))

  await waitFor(() => expect(mocks.saveResult).toHaveBeenCalledTimes(1))
  expect(mocks.uploadEvidence).toHaveBeenCalledTimes(2)
  expect(mocks.uploadEvidence).toHaveBeenNthCalledWith(1, expect.objectContaining({
    referenceType: 'PROCESSING_JOB', referenceId: 17, evidenceType: 'BEFORE_PHOTO',
  }))
  expect(mocks.uploadEvidence).toHaveBeenNthCalledWith(2, expect.objectContaining({
    referenceType: 'PROCESSING_JOB', referenceId: 17, evidenceType: 'AFTER_PHOTO',
  }))
  // 서버가 모르는 값(File, 업로드 id)은 요청에 실리지 않는다.
  expect(mocks.saveResult).toHaveBeenCalledWith({
    outputs: [{ grade: 'A', gradeReason: '오염과 손상이 없음', name: '재생 데님 원단', quantity: 650 }],
  })

  await user.click(screen.getByRole('button', { name: '결과 임시 저장' }))

  await waitFor(() => expect(mocks.saveResult).toHaveBeenCalledTimes(2))
  expect(mocks.uploadEvidence).toHaveBeenCalledTimes(2)
})

/*
  사진은 산출 수량의 근거다. 업로드가 실패했는데 저장이 넘어가면 수량만 남고 근거가 없는
  결과가 되고, 가공사는 증빙을 올렸다고 믿는다.
*/
test('저울 사진 증빙 업로드가 실패하면 결과를 저장하지 않고 이유를 알린다', async () => {
  mocks.recognizeWeight.mockResolvedValue(recognized(650))
  mocks.uploadEvidence.mockRejectedValue(new Error('network'))
  const user = userEvent.setup()
  render(<MemoryRouter><ProcessingJobDetail jobId={17} /></MemoryRouter>)

  await user.type(screen.getByLabelText('산출물 1 소재명'), '재생 데님 원단')
  await user.type(screen.getByLabelText('산출물 1 등급 판정 사유'), '오염과 손상이 없음')
  await user.type(screen.getByLabelText('산출물 1 산출 수량(g)'), '650')
  await user.upload(screen.getByLabelText('산출물 1 가공 후 저울 사진'), scalePhoto('after.jpg'))

  await user.click(screen.getByRole('button', { name: '결과 임시 저장' }))

  await screen.findByText('저울 사진 증빙 업로드에 실패했습니다. 다시 시도해 주세요.')
  expect(mocks.saveResult).not.toHaveBeenCalled()
})
