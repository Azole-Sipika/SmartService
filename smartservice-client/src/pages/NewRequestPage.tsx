
import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import './NewRequestPage.css'

const API_URL = 'http://localhost:5255'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES = 5

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
]

type CreatedTicket = {
  id: number
  title: string
}

type CreateTicketResponse = {
  message: string
  ticket: CreatedTicket
}

function NewRequestPage() {
  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [loading, setLoading] = useState(false)

  const [uploadProgress, setUploadProgress] = useState(0)

  const [uploadingFile, setUploadingFile] = useState('')

  const [createdTicketId, setCreatedTicketId] = useState<number | null>(
    null
  )

  // ==========================================
  // FORMAT FILE SIZE
  // ==========================================

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // ==========================================
  // VALIDATE FILE
  // ==========================================

  const validateFile = (file: File): string | null => {
    const extension =
      '.' + (file.name.split('.').pop() || '').toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `${file.name}: Only JPG, JPEG, PNG and PDF files are allowed.`
    }

    if (file.size === 0) {
      return `${file.name}: The file is empty.`
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: Maximum file size is 5 MB.`
    }

    return null
  }

  // ==========================================
  // HANDLE FILE SELECTION
  // ==========================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setError('')

    const files = Array.from(event.target.files || [])

    if (files.length === 0) {
      return
    }

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of files) {
      const validationError = validateFile(file)

      if (validationError) {
        errors.push(validationError)
        continue
      }

      const alreadySelected = [
        ...selectedFiles,
        ...validFiles,
      ].some(
        (existingFile) =>
          existingFile.name === file.name &&
          existingFile.size === file.size &&
          existingFile.lastModified === file.lastModified
      )

      if (alreadySelected) {
        errors.push(`${file.name}: File already selected.`)
        continue
      }

      if (
        selectedFiles.length + validFiles.length >= MAX_FILES
      ) {
        errors.push(
          `You can attach a maximum of ${MAX_FILES} files.`
        )
        break
      }

      validFiles.push(file)
    }

    if (validFiles.length > 0) {
      setSelectedFiles((previous) => [
        ...previous,
        ...validFiles,
      ])
    }

    if (errors.length > 0) {
      setError(errors.join(' '))
    }

    // Allow the same file to be selected again
    // after removing it from the list.
    event.target.value = ''
  }

  // ==========================================
  // REMOVE SELECTED FILE
  // ==========================================

  const removeFile = (index: number) => {
    setSelectedFiles((previous) =>
      previous.filter((_, fileIndex) => fileIndex !== index)
    )
  }

  // ==========================================
  // HANDLE AUTHENTICATION ERROR
  // ==========================================

  const handleUnauthorized = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // ==========================================
  // UPLOAD ATTACHMENTS
  // ==========================================

  const uploadAttachments = async (
    ticketId: number,
    token: string
  ): Promise<string[]> => {
    const failedFiles: string[] = []

    for (let index = 0; index < selectedFiles.length; index++) {
      const file = selectedFiles[index]

      setUploadingFile(file.name)
      setUploadProgress(0)

      const formData = new FormData()

      // Must match the backend parameter:
      // [FromForm] IFormFile file
      formData.append('file', file)

      try {
        await axios.post(
          `${API_URL}/api/tickets/${ticketId}/attachments`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentage = Math.round(
                  (progressEvent.loaded * 100) /
                    progressEvent.total
                )

                setUploadProgress(percentage)
              }
            },
          }
        )
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 401
        ) {
          throw err
        }

        failedFiles.push(file.name)
      }
    }

    setUploadingFile('')
    setUploadProgress(0)

    return failedFiles
  }

  // ==========================================
  // CREATE SERVICE REQUEST
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (loading) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    let ticketId = createdTicketId

    try {
      // STEP 1:
      // Create the ticket using the existing API.
      // If a previous upload failed, reuse the
      // ticket instead of creating a duplicate.

      if (ticketId === null) {
        const response = await axios.post<CreateTicketResponse>(
          `${API_URL}/api/Tickets`,
          {
            title: title.trim(),
            description: description.trim(),
            priority,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        ticketId = response.data.ticket.id

        if (!Number.isInteger(ticketId) || ticketId <= 0) {
          throw new Error('Invalid ticket ID returned by the API.')
        }

        setCreatedTicketId(ticketId)
      }

      // STEP 2:
      // Upload attachments after ticket creation.

      if (selectedFiles.length > 0) {
        const failedFiles = await uploadAttachments(
          ticketId,
          token
        )

        if (failedFiles.length > 0) {
          // Keep only failed files so retrying
          // does not upload successful files twice.
          setSelectedFiles((previous) =>
            previous.filter((file) =>
              failedFiles.includes(file.name)
            )
          )

          setError(
            `Service request #${ticketId} was created, ` +
              `but some attachments failed to upload: ` +
              failedFiles.join(', ') +
              '. You can retry uploading these files.'
          )

          return
        }
      }

      // STEP 3:
      // All operations completed successfully.

      setSuccess('Service request created successfully.')

      setSelectedFiles([])

      navigate('/dashboard')
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      if (ticketId !== null) {
        setError(
          `Service request #${ticketId} was created, ` +
            'but the attachment upload could not be completed. ' +
            'Please try again.'
        )
      } else {
        setError('Unable to create service request.')
      }
    } finally {
      setLoading(false)
      setUploadingFile('')
      setUploadProgress(0)
    }
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="new-request-page">
      <div className="request-form-card">

        {/* HEADER */}

        <div className="request-form-header">
          <div className="request-logo">S</div>

          <div>
            <h1>New Service Request</h1>

            <p>
              Tell us what you need help with.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* TITLE */}

          <div className="request-field">
            <label htmlFor="title">
              Request title
            </label>

            <input
              id="title"
              type="text"
              placeholder="Example: Laptop cannot connect to Wi-Fi"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              required
              disabled={loading || createdTicketId !== null}
            />
          </div>

          {/* DESCRIPTION */}

          <div className="request-field">
            <label htmlFor="description">
              Description
            </label>

            <textarea
              id="description"
              placeholder="Describe the problem in detail..."
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={6}
              required
              disabled={loading || createdTicketId !== null}
            />
          </div>

          {/* PRIORITY */}

          <div className="request-field">
            <label htmlFor="priority">
              Priority
            </label>

            <select
              id="priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value)
              }
              disabled={loading || createdTicketId !== null}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {/* FILE ATTACHMENTS */}

          <div className="request-field">
            <label htmlFor="request-attachments">
              Attachments (optional)
            </label>

            <div className="request-upload-area">
              <div className="request-upload-icon">
                📎
              </div>

              <h3>Attach supporting documents</h3>

              <p>
                Upload screenshots, photos or PDF documents
                related to your service request.
              </p>

              <input
                ref={fileInputRef}
                id="request-attachments"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={handleFileChange}
                disabled={loading}
                className="request-file-input"
              />

              <button
                type="button"
                className="request-choose-file-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  loading ||
                  selectedFiles.length >= MAX_FILES
                }
              >
                Choose Files
              </button>

              <span className="request-upload-hint">
                JPG, JPEG, PNG or PDF • Max 5 MB per file
                • Up to 5 files
              </span>
            </div>
          </div>

          {/* SELECTED FILES */}

          {selectedFiles.length > 0 && (
            <div className="request-selected-files">
              <h3>
                Selected Attachments ({selectedFiles.length})
              </h3>

              <div className="request-file-list">
                {selectedFiles.map((file, index) => (
                  <div
                    className="request-file-item"
                    key={`${file.name}-${file.lastModified}-${index}`}
                  >
                    <div className="request-file-info">
                      <span className="request-file-icon">
                        {file.type === 'application/pdf'
                          ? '📄'
                          : '🖼️'}
                      </span>

                      <div>
                        <strong>{file.name}</strong>

                        <small>
                          {formatFileSize(file.size)}
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="request-remove-file"
                      onClick={() => removeFile(index)}
                      disabled={loading}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPLOAD PROGRESS */}

          {loading && uploadingFile && (
            <div className="request-upload-progress">
              <div className="request-progress-heading">
                <strong>Uploading attachment...</strong>

                <span>{uploadProgress}%</span>
              </div>

              <p>{uploadingFile}</p>

              <div className="request-progress-track">
                <div
                  className="request-progress-fill"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="request-error" role="alert">
              {error}
            </div>
          )}

          {/* SUCCESS */}

          {success && (
            <div className="request-success" role="status">
              {success}
            </div>
          )}

          {/* ACTION BUTTONS */}

          <div className="request-actions">
            <button
              type="button"
              className="cancel-request-button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="submit-request-button"
              disabled={loading}
            >
              {loading
                ? uploadingFile
                  ? 'Uploading Files...'
                  : 'Creating...'
                : createdTicketId !== null
                  ? 'Retry Failed Uploads'
                  : 'Create Service Request'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default NewRequestPage
