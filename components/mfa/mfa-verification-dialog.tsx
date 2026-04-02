"use client"

import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OTPInput } from "./otp-input"
import { useToast } from "@/hooks/use-toast"
import { handleError } from "@/lib/error-handler"
import { jsonFetcher } from "@/lib/fetcher"
import { signIn } from "next-auth/react"
import { Shield, Clock, RefreshCw, CheckCircle, AlertCircle } from "lucide-react"

interface MFAVerificationDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (otpCode?: string) => void
  type?: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD'
  username?: string
  userPassword?: string
  isEmployee?: boolean
}

export function MFAVerificationDialog({
  open,
  onClose,
  onSuccess,
  type = 'LOGIN',
  username,
  userPassword,
  isEmployee = false
}: MFAVerificationDialogProps) {
  const [otp, setOtp] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [canResend, setCanResend] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const hasSentOTP = useRef(false)
  const isSendingRef = useRef(false)
  const { toast } = useToast()

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  // Send OTP on dialog open (only once)
  useEffect(() => {
    if (open && !hasSentOTP.current) {
      console.log("MFA Dialog: Sending OTP for", username)
      hasSentOTP.current = true
      sendOTP()
    }
  }, [open, username])

  // Reset flags when dialog closes
  useEffect(() => {
    if (!open) {
      hasSentOTP.current = false
      isSendingRef.current = false
    }
  }, [open])

  const sendOTP = async () => {
    if (isSending || isSendingRef.current) {
      console.log("MFA Dialog: Already sending OTP, skipping")
      return // Prevent multiple simultaneous sends
    }

    console.log("MFA Dialog: Starting OTP send for", username)
    isSendingRef.current = true
    setIsSending(true)
    setError(null)
    setOtp("")

    try {
      const response = await jsonFetcher("/api/v1/mfa/login/send-otp", {
        method: "POST",
        body: JSON.stringify({ username, type })
      }) as any

      if (response.error) {
        throw new Error(response.error)
      }

      toast({
        title: "OTP Sent",
        description: response.message,
        variant: "default",
      })

      setTimeLeft(120) // 2 minutes
      setCanResend(false)
      setRemainingAttempts(null)

    } catch (error: any) {
      const { message } = handleError(error, "send OTP")
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const verifyOTP = async (otpCode: string) => {
    console.log("MFA Dialog - verifyOTP called with:", otpCode ? "***" : "undefined")
    setIsVerifying(true)
    setError(null)

    try {
      if (type === 'LOGIN' && username && userPassword) {
        // Use MFA credentials provider for login
        const providerId = isEmployee ? "employee-mfa-credentials" : "mfa-credentials"
        const result = await signIn(providerId, {
          username: username,
          password: userPassword,
          otp: otpCode,
          redirect: false
        })

        if (result?.error) {
          // NextAuth returns generic error codes like "CredentialsSignin"
          // Map them to user-friendly messages
          const errorMessage = result.error === "CredentialsSignin"
            ? "Invalid or expired OTP code. Please check and try again."
            : result.error
          throw new Error(errorMessage)
        }

        toast({
          title: "Login Successful",
          description: "You have been successfully logged in.",
          variant: "default",
        })

        // Show loading state while dashboard compiles
        setIsRedirecting(true)

        // Delay redirect to allow dashboard compilation (5 seconds for better UX)
        setTimeout(() => {
          console.log("MFA Dialog - Calling onSuccess with OTP:", otpCode ? "***" : "undefined")
          onSuccess(otpCode)
          onClose()
        }, 5000) // 5 second delay
      } else {
        // Use API for other MFA types
        const response = await jsonFetcher("/api/v1/mfa/login/verify-otp", {
          method: "POST",
          body: JSON.stringify({ username: username, code: otpCode, type })
        }) as any

        if (response.error) {
          throw new Error(response.error)
        }

        toast({
          title: "Success",
          description: response.message,
          variant: "default",
        })

        console.log("MFA Dialog - Calling onSuccess with OTP:", otpCode ? "***" : "undefined", "otpCode param:", otpCode)
        onSuccess(otpCode)
        onClose()
      }

    } catch (error: any) {
      const { message, field } = handleError(error, "verify OTP")
      setError(message)

      // Handle specific error responses
      if (error.remainingAttempts !== undefined) {
        setRemainingAttempts(error.remainingAttempts)
      }

      toast({
        title: "Verification Failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    await sendOTP()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Verify Your Identity
          </DialogTitle>
          <DialogDescription>
            {type === 'LOGIN' && "Enter the 6-digit code sent to your email to complete login"}
            {type === 'VERIFY_EMAIL' && "Enter the 6-digit code sent to your email to verify your email address"}
            {type === 'RESET_PASSWORD' && "Enter the 6-digit code sent to your email to reset your password"}
          </DialogDescription>
        </DialogHeader>

        {/* Loading Screen for Redirect */}
        {isRedirecting && (
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-xl font-semibold text-gray-900">Login Successful!</h3>
              <p className="text-sm text-gray-600">
                Preparing your personalized dashboard...
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse"></div>
              </div>

              <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
                <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>

              <p className="text-xs text-gray-400">
                This may take a few moments...
              </p>
            </div>
          </div>
        )}

        {/* Normal MFA Content */}
        {!isRedirecting && (
          <div className="space-y-6 py-4">
            {/* Username Display */}
            {username && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Code sent to the email associated with <span className="font-medium">{username}</span>
                </p>
              </div>
            )}

            {/* OTP Input */}
            <div className="space-y-4">
              <div className="text-center">
                <label className="text-sm font-medium">Enter OTP Code</label>
              </div>
              <OTPInput
                value={otp}
                onChange={setOtp}
                onComplete={verifyOTP}
                disabled={isVerifying || isSending}
                error={!!error}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="text-sm text-red-700">
                  <p>{error}</p>
                  {remainingAttempts !== null && (
                    <p className="text-xs mt-1">
                      {remainingAttempts} attempts remaining
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Timer and Resend */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {timeLeft > 0 ? (
                  <span>Code expires in {formatTime(timeLeft)}</span>
                ) : (
                  <span>Code has expired</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={!canResend || isSending}
                className="flex items-center gap-2"
              >
                {isSending ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Resend OTP
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                onClick={() => verifyOTP(otp)}
                disabled={otp.length !== 6 || isVerifying || isSending}
                className="flex-1"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
