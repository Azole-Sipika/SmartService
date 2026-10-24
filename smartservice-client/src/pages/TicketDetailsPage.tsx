
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import './TicketDetailsPage.css'

const API_URL = 'http://localhost:5255'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES_PER_SELECTION = 5

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
]

type Ticket = {
  id: number
  title: string
  description: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  customerId: number
  assignedEmployeeId: number | null
}

type Comment = {
  id: number
  message: string
  createdAt: string
  userId: number
  userName: string
  userRole: string
}

type Activity = {
  id: number
  action: string
  description: string
  createdAt: string
  userId: number
  userName: string
  userRole: string
}

type TicketAttachment = {
  id: number
  ticketId: number
  uploadedByUserId: number
  fileName: string
  contentType: string
  fileSize: number
  uploadedAt: string
}

type User = {
  id: number
  role: string
}

function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem('user')

    if (!stored) {
      return null
    }

    const parsed: unknown = JSON.parse(stored)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const data = parsed as Record<string, unknown>

    const id = Number(data.id)

    if (
      !Number.isInteger(id) ||
      typeof data.role !== 'string'
    ) {
      return null
    }

    return {
      id,
      role: data.role.trim().toUpperCase(),
    }
  } catch {
    return null
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileExtension(name: string): string {
  const index = name.lastIndexOf('.')

  return index >= 0
    ? name.slice(index).toLowerCase()
    : ''
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data

    if (data && typeof data === 'object') {
      const message = (
        data as Record<string, unknown>
      ).message

      if (typeof message === 'string') {
        return message
      }
    }
  }

  return fallback
}

function TicketDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])

  const [comment, setComment] = useState('')
  const [newStatus, setNewStatus] = useState('IN_PROGRESS')

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFile, setUploadingFile] = useState('')

  const [downloadingId, setDownloadingId] = useState<number | null>(
    null
  )

  const [deletingId, setDeletingId] = useState<number | null>(
    null
  )

  const [attachmentError, setAttachmentError] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const user = getStoredUser()

  const userId = user?.id ?? null
  const userRole = user?.role ?? ''

  const isCustomer = userRole === 'CUSTOMER'
  const isEmployee = userRole === 'EMPLOYEE'
  const isManager = userRole === 'MANAGER'

  const isAssignedEmployee =
    isEmployee &&
    ticket !== null &&
    userId !== null &&
    ticket.assignedEmployeeId === userId

  const canUpload =
    isCustomer &&
    ticket !== null &&
    ticket.customerId === userId

  const dashboardPath =
    isEmployee
      ? '/employee/dashboard'
      : isManager
        ? '/manager/dashboard'
        : '/dashboard'

  const ticketId = Number(id)

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }, [navigate])

  // ==========================================
  // LOAD ATTACHMENTS
  // ==========================================

  const loadAttachments = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return
    }

    try {
      setAttachmentError('')

      const response = await axios.get<TicketAttachment[]>(
        `${API_URL}/api/tickets/${ticketId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setAttachments(response.data)
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      setAttachmentError(
        getErrorMessage(
          err,
          'Unable to load ticket attachments.'
        )
      )
    }
  }, [ticketId, handleUnauthorized])

  // ==========================================
  // LOAD TICKET, COMMENTS AND HISTORY
  // ==========================================

  const loadTicketData = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      setError('Invalid service request.')
      setLoading(false)
      return
    }

    try {
      setError('')

      const headers = {
        Authorization: `Bearer ${token}`,
      }

      let ticketData: Ticket

      if (isEmployee) {
        const assignedResponse = await axios.get<Ticket[]>(
          `${API_URL}/api/Tickets/assigned`,
          { headers }
        )

        const assignedTicket = assignedResponse.data.find(
          (item) => item.id === ticketId
        )

        if (!assignedTicket) {
          setTicket(null)
          setError(
            'This ticket is not assigned to your account.'
          )
          return
        }

        ticketData = assignedTicket
      } else if (isManager) {
        // Managers use the existing manager-specific
        // endpoint because GET /api/Tickets/{id}
        // currently permits customers only.

        const response = await axios.get<Ticket[]>(
          `${API_URL}/api/Tickets/manager/all`,
          { headers }
        )

        const managerTicket = response.data.find(
          (item) => item.id === ticketId
        )

        if (!managerTicket) {
          setTicket(null)
          setError('Service request not found.')
          return
        }

        ticketData = managerTicket
      } else {
        const ticketResponse = await axios.get<Ticket>(
          `${API_URL}/api/Tickets/${ticketId}`,
          { headers }
        )

        ticketData = ticketResponse.data
      }

      const [commentsResponse, activityResponse] =
        await Promise.all([
          axios.get<Comment[]>(
            `${API_URL}/api/Comments/${ticketId}`,
            { headers }
          ),

          axios.get<Activity[]>(
            `${API_URL}/api/TicketActivities/${ticketId}`,
            { headers }
          ),
        ])

      setTicket(ticketData)
      setComments(commentsResponse.data)
      setActivities(activityResponse.data)

      setNewStatus(
        ticketData.status === 'RESOLVED'
          ? 'RESOLVED'
          : 'IN_PROGRESS'
      )

      await loadAttachments()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          handleUnauthorized()
          return
        }

        if (err.response?.status === 404) {
          setError('Service request not found.')
          return
        }

        if (err.response?.status === 403) {
          setError(
            'You do not have permission to view this service request.'
          )
          return
        }
      }

      setError('Unable to load this service request.')
    } finally {
      setLoading(false)
    }
  }, [
    ticketId,
    isEmployee,
    isManager,
    handleUnauthorized,
    loadAttachments,
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTicketData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTicketData])

  // ==========================================
  // UPDATE TICKET STATUS
  // ==========================================

  const handleUpdateStatus = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!isAssignedEmployee) {
      setError(
        'Only the assigned employee can update this ticket.'
      )
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    try {
      setUpdatingStatus(true)
      setError('')
      setSuccess('')

      await axios.put(
        `${API_URL}/api/Tickets/${ticketId}/status`,
        JSON.stringify(newStatus),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      await loadTicketData()

      setSuccess('Ticket status updated successfully.')
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      setError(
        getErrorMessage(
          err,
          'Unable to update ticket status.'
        )
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  // ==========================================
  // ADD COMMENT
  // ==========================================

  const handleAddComment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    const message = comment.trim()

    if (!message) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    try {
      setSending(true)
      setError('')
      setSuccess('')

      await axios.post(
        `${API_URL}/api/Comments/${ticketId}`,
        JSON.stringify(message),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      setComment('')

      await loadTicketData()

      setSuccess('Comment added successfully.')
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      setError(
        getErrorMessage(err, 'Unable to add your comment.')
      )
    } finally {
      setSending(false)
    }
  }

  // ==========================================
  // SELECT ATTACHMENTS
  // ==========================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || [])

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of files) {
      const extension = getFileExtension(file.name)

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        errors.push(
          `${file.name}: Only JPG, PNG and PDF files are allowed.`
        )
        continue
      }

      if (file.size === 0) {
        errors.push(`${file.name}: File is empty.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `${file.name}: Maximum file size is 5 MB.`
        )
        continue
      }

      const duplicate = [
        ...selectedFiles,
        ...validFiles,
      ].some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      )

      if (duplicate) {
        errors.push(`${file.name}: Already selected.`)
        continue
      }

      if (
        selectedFiles.length + validFiles.length >=
        MAX_FILES_PER_SELECTION
      ) {
        errors.push(
          `Select up to ${MAX_FILES_PER_SELECTION} files at a time.`
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

    setAttachmentError(errors.join(' '))

    event.target.value = ''
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    )
  }

  // ==========================================
  // UPLOAD ATTACHMENTS
  // ==========================================

  const handleUploadAttachments = async () => {
    if (!canUpload || selectedFiles.length === 0) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    setUploading(true)
    setAttachmentError('')
    setError('')
    setSuccess('')

    const failedFiles: File[] = []
    let successfulUploads = 0

    try {
      for (const file of selectedFiles) {
        setUploadingFile(file.name)
        setUploadProgress(0)

        const formData = new FormData()
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
                  setUploadProgress(
                    Math.round(
                      (progressEvent.loaded * 100) /
                        progressEvent.total
                    )
                  )
                }
              },
            }
          )

          successfulUploads += 1
        } catch (err) {
          if (
            axios.isAxiosError(err) &&
            err.response?.status === 401
          ) {
            handleUnauthorized()
            return
          }

          failedFiles.push(file)

          setAttachmentError(
            getErrorMessage(
              err,
              'Some attachments could not be uploaded.'
            )
          )
        }
      }

      setSelectedFiles(failedFiles)

      if (successfulUploads > 0) {
        await loadAttachments()
      }

      if (failedFiles.length === 0) {
        setSuccess('Attachments uploaded successfully.')
      } else if (successfulUploads > 0) {
        setSuccess(
          `${successfulUploads} attachment(s) uploaded successfully.`
        )
      }
    } finally {
      setUploading(false)
      setUploadingFile('')
      setUploadProgress(0)
    }
  }

  // ==========================================
  // DOWNLOAD ATTACHMENT
  // ==========================================

  const handleDownloadAttachment = async (
    attachment: TicketAttachment
  ) => {
    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    try {
      setDownloadingId(attachment.id)
      setAttachmentError('')

      const response = await axios.get<Blob>(
        `${API_URL}/api/tickets/${ticketId}/attachments/${attachment.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      )

      const blob = response.data
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')

      link.href = url
      link.download = attachment.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      setAttachmentError(
        'Unable to download the attachment.'
      )
    } finally {
      setDownloadingId(null)
    }
  }

  // ==========================================
  // DELETE ATTACHMENT
  // ==========================================

  const handleDeleteAttachment = async (
    attachment: TicketAttachment
  ) => {
    if (
      !canUpload ||
      attachment.uploadedByUserId !== userId
    ) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${attachment.fileName}"?`
    )

    if (!confirmed) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      handleUnauthorized()
      return
    }

    try {
      setDeletingId(attachment.id)
      setAttachmentError('')
      setSuccess('')

      await axios.delete(
        `${API_URL}/api/tickets/${ticketId}/attachments/${attachment.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      await loadAttachments()

      setSuccess('Attachment deleted successfully.')
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        handleUnauthorized()
        return
      }

      setAttachmentError(
        getErrorMessage(
          err,
          'Unable to delete the attachment.'
        )
      )
    } finally {
      setDeletingId(null)
    }
  }

  // ==========================================
  // LOADING / ERROR
  // ==========================================

  if (loading) {
    return (
      <div className="ticket-details-state">
        Loading service request...
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="ticket-details-state">
        <p>{error || 'Service request not found.'}</p>

        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="ticket-details-page">
      <main className="ticket-details-container">

        {/* BACK BUTTON */}

        <button
          type="button"
          className="back-button"
          onClick={() => navigate(dashboardPath)}
        >
          ← Back to Dashboard
        </button>

        {/* TICKET HEADER */}

        <section className="ticket-details-header">
          <div>
            <p className="ticket-reference">
              SERVICE REQUEST #{ticket.id}
            </p>

            <h1>{ticket.title}</h1>

            <p>
              Created{' '}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="ticket-header-badges">
            <span
              className={`priority priority-${ticket.priority.toLowerCase()}`}
            >
              {ticket.priority}
            </span>

            <span
              className={`status status-${ticket.status
                .toLowerCase()
                .replaceAll('_', '-')}`}
            >
              {ticket.status.replaceAll('_', ' ')}
            </span>
          </div>
        </section>

        {/* DESCRIPTION AND INFORMATION */}

        <div className="ticket-details-grid">
          <section className="details-card">
            <h2>Description</h2>
            <p>{ticket.description}</p>
          </section>

          <section className="details-card">
            <h2>Request Information</h2>

            <div className="information-row">
              <span>Status</span>
              <strong>
                {ticket.status.replaceAll('_', ' ')}
              </strong>
            </div>

            <div className="information-row">
              <span>Priority</span>
              <strong>{ticket.priority}</strong>
            </div>

            <div className="information-row">
              <span>Assigned Employee</span>
              <strong>
                {ticket.assignedEmployeeId !== null
                  ? `Employee #${ticket.assignedEmployeeId}`
                  : 'Not assigned yet'}
              </strong>
            </div>
          </section>
        </div>

        {/* EMPLOYEE STATUS MANAGEMENT */}

        {isAssignedEmployee && (
          <section className="details-card employee-status-management">
            <h2>Manage Ticket Status</h2>

            <p>
              Update the progress of this assigned request.
            </p>

            <form
              className="ticket-status-form"
              onSubmit={handleUpdateStatus}
            >
              <label htmlFor="ticketStatus">
                Ticket Status
              </label>

              <select
                id="ticketStatus"
                value={newStatus}
                onChange={(event) =>
                  setNewStatus(event.target.value)
                }
              >
                <option value="IN_PROGRESS">
                  In Progress
                </option>

                <option value="RESOLVED">
                  Resolved
                </option>
              </select>

              <button
                type="submit"
                disabled={
                  updatingStatus ||
                  newStatus === ticket.status
                }
              >
                {updatingStatus
                  ? 'Updating...'
                  : 'Update Status'}
              </button>
            </form>
          </section>
        )}

        {/* =====================================
            TICKET ATTACHMENTS
            ===================================== */}

        <section className="details-card ticket-attachments-section">
          <div className="ticket-attachments-heading">
            <div>
              <h2>Attachments</h2>
              <p>
                Photos and documents related to this
                service request.
              </p>
            </div>

            <span className="ticket-attachment-count">
              {attachments.length} file(s)
            </span>
          </div>

          {attachmentError && (
            <p
              className="ticket-error"
              role="alert"
            >
              {attachmentError}
            </p>
          )}

          {attachments.length === 0 ? (
            <p className="empty-message">
              No attachments uploaded yet.
            </p>
          ) : (
            <div className="ticket-attachments-list">
              {attachments.map((attachment) => {
                const isPdf =
                  attachment.contentType ===
                  'application/pdf'

                const canDelete =
                  canUpload &&
                  attachment.uploadedByUserId === userId

                return (
                  <div
                    key={attachment.id}
                    className="ticket-attachment-item"
                  >
                    <div className="ticket-attachment-info">
                      <span className="ticket-attachment-icon">
                        {isPdf ? '📄' : '🖼️'}
                      </span>

                      <div>
                        <strong>
                          {attachment.fileName}
                        </strong>

                        <small>
                          {formatFileSize(
                            attachment.fileSize
                          )}
                          {' · '}
                          {new Date(
                            attachment.uploadedAt
                          ).toLocaleString()}
                        </small>
                      </div>
                    </div>

                    <div className="ticket-attachment-actions">
                      <button
                        type="button"
                        className="ticket-attachment-download"
                        onClick={() =>
                          void handleDownloadAttachment(
                            attachment
                          )
                        }
                        disabled={
                          downloadingId === attachment.id
                        }
                      >
                        {downloadingId === attachment.id
                          ? 'Downloading...'
                          : 'Download'}
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          className="ticket-attachment-delete"
                          onClick={() =>
                            void handleDeleteAttachment(
                              attachment
                            )
                          }
                          disabled={
                            deletingId === attachment.id
                          }
                        >
                          {deletingId === attachment.id
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* CUSTOMER UPLOAD AREA */}

          {canUpload && (
            <div className="ticket-attachment-upload">
              <h3>Add More Attachments</h3>

              <p>
                Supported formats: JPG, JPEG, PNG and PDF.
                Maximum 5 MB per file.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={handleFileChange}
                disabled={uploading}
                className="ticket-attachment-file-input"
                aria-label="Select ticket attachments"
              />

              <button
                type="button"
                className="ticket-attachment-choose"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={
                  uploading ||
                  selectedFiles.length >=
                    MAX_FILES_PER_SELECTION
                }
              >
                Choose Files
              </button>

              {selectedFiles.length > 0 && (
                <div className="ticket-selected-files">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="ticket-selected-file"
                    >
                      <span>
                        {file.name}
                        {' · '}
                        {formatFileSize(file.size)}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeSelectedFile(index)
                        }
                        disabled={uploading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploading && uploadingFile && (
                <div className="ticket-upload-progress">
                  <div className="ticket-upload-progress-label">
                    <span>{uploadingFile}</span>
                    <strong>{uploadProgress}%</strong>
                  </div>

                  <div className="ticket-upload-progress-track">
                    <div
                      className="ticket-upload-progress-fill"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                className="ticket-attachment-upload-button"
                onClick={() =>
                  void handleUploadAttachments()
                }
                disabled={
                  uploading ||
                  selectedFiles.length === 0
                }
              >
                {uploading
                  ? 'Uploading...'
                  : 'Upload Attachments'}
              </button>
            </div>
          )}
        </section>

        {/* FEEDBACK */}

        {error && (
          <p className="ticket-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="ticket-success" role="status">
            {success}
          </p>
        )}

        {/* COMMENTS AND HISTORY */}

        <div className="ticket-lower-grid">
          <section className="details-card">
            <h2>Comments</h2>

            {comments.length === 0 ? (
              <p className="empty-message">
                No comments yet.
              </p>
            ) : (
              <div className="comments-list">
                {comments.map((item) => (
                  <article
                    className="comment-item"
                    key={item.id}
                  >
                    <div className="comment-header">
                      <strong>{item.userName}</strong>
                      <span>{item.userRole}</span>
                    </div>

                    <p>{item.message}</p>

                    <small>
                      {new Date(
                        item.createdAt
                      ).toLocaleString()}
                    </small>
                  </article>
                ))}
              </div>
            )}

            <form
              className="comment-form"
              onSubmit={handleAddComment}
            >
              <textarea
                placeholder="Write a comment..."
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                rows={4}
              />

              <button
                type="submit"
                disabled={sending || !comment.trim()}
              >
                {sending
                  ? 'Sending...'
                  : 'Send Comment'}
              </button>
            </form>
          </section>

          <section className="details-card">
            <h2>Activity History</h2>

            {activities.length === 0 ? (
              <p className="empty-message">
                No activity recorded yet.
              </p>
            ) : (
              <div className="activity-list">
                {activities.map((activity) => (
                  <article
                    className="activity-item"
                    key={activity.id}
                  >
                    <div className="activity-dot" />

                    <div>
                      <strong>
                        {activity.description}
                      </strong>

                      <p>
                        {activity.userName}
                        {' · '}
                        {activity.userRole}
                      </p>

                      <small>
                        {new Date(
                          activity.createdAt
                        ).toLocaleString()}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default TicketDetailsPage
