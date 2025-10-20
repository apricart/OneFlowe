"use client"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { UserPlus, Mail, Phone, Shield, Building2, MapPin, AlertCircle, CheckCircle, Plus } from "lucide-react"
import { useAppContext } from "@/components/context/app-context"
import { useToast } from "@/components/ui/use-toast"
import { handleError } from "@/lib/error-handler"

type CreateUserDialogProps = {
  onSuccess?: () => void
}

export function CreateUserDialog({ onSuccess }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const { organizationId, userRole } = useAppContext()
  const { toast } = useToast()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    role: "",
    branchId: "",
    mfaEnabled: false
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch branches for the current organization
  const { data: branchesData } = useSWR(
    organizationId ? `/api/v1/branches?organizationId=${organizationId}` : null,
    jsonFetcher
  )

  const branches = branchesData?.items || []

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        role: "",
        branchId: "",
        mfaEnabled: false
      })
      setErrors({})
      setStep(1)
    }
  }, [open])

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!form.firstName.trim()) newErrors.firstName = "First name is required"
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required"
    if (!form.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Please enter a valid email"
    }
    if (!form.password) newErrors.password = "Password is required"
    if (form.password && form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }
    if (!form.role) newErrors.role = "Role is required"
    if (form.role === "BRANCH_ADMIN" && !form.branchId) {
      newErrors.branchId = "Branch assignment is required for Branch Admin"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const response = await jsonFetcher("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
          role: form.role,
          organizationId: organizationId,
          branchId: form.role === "BRANCH_ADMIN" ? parseInt(form.branchId) : null,
          mfaEnabled: form.mfaEnabled
        })
      })

      if (response.error) {
        throw new Error(response.error)
      }

      toast({
        title: "Success!",
        description: "User created successfully.",
        variant: "default",
      })

      onSuccess?.()
      setOpen(false)
    } catch (error: any) {
      const { message, field } = handleError(error, "create user")
      
      // Show toast notification
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })

      // Highlight the problematic field
      if (field) {
        setErrors({ [field]: message })
        // Focus on the problematic field
        setTimeout(() => {
          const fieldElement = document.querySelector(`[name="${field}"]`) as HTMLInputElement
          if (fieldElement) {
            fieldElement.focus()
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Get selected branch name
  const getSelectedBranchName = () => {
    if (!form.branchId) return ""
    const branch = branches.find(b => b.id === parseInt(form.branchId))
    return branch?.name || ""
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ background: "var(--color-brand-primary)", color: "white" }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new Head Office or Branch Admin user to your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-muted'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Basic Info</span>
            </div>
            <div className={`h-px w-8 ${step >= 2 ? 'bg-blue-600' : 'bg-muted'}`} />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-muted'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Role & Assignment</span>
            </div>
            <div className={`h-px w-8 ${step >= 3 ? 'bg-blue-600' : 'bg-muted'}`} />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 3 ? 'bg-blue-100 text-blue-600' : 'bg-muted'
              }`}>
                3
            </div>
              <span className="text-sm font-medium">Security</span>
            </div>
          </div>

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Enter first name"
                    className={errors.firstName ? 'border-red-500' : ''}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-600">{errors.firstName}</p>
                  )}
          </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Enter last name"
                    className={errors.lastName ? 'border-red-500' : ''}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-600">{errors.lastName}</p>
                  )}
            </div>
          </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter email address"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="Enter phone number (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter password (min 6 characters)"
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password}</p>
                )}
          </div>
            </div>
          )}

          {/* Step 2: Role & Assignment */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Role & Assignment</h3>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={form.role} onValueChange={value => setForm({ ...form, role: value, branchId: "" })}>
                  <SelectTrigger name="role" className={errors.role ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                    <SelectItem value="BRANCH_ADMIN">Branch Admin</SelectItem>
                </SelectContent>
              </Select>
                {errors.role && (
                  <p className="text-xs text-red-600">{errors.role}</p>
                )}
            </div>

              {form.role === "BRANCH_ADMIN" && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch Assignment *</Label>
                  <Select value={form.branchId} onValueChange={value => setForm({ ...form, branchId: value })}>
                    <SelectTrigger name="branchId" className={errors.branchId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={String(branch.id)}>
                          {branch.name}
                        </SelectItem>
                ))}
              </SelectContent>
            </Select>
                  {errors.branchId && (
                    <p className="text-xs text-red-600">{errors.branchId}</p>
                  )}
                </div>
              )}

              {/* Assignment Summary */}
              {form.role && (
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Assignment Summary</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {form.role === "HEAD_OFFICE" ? (
                          "This user will have access to all branches in your organization"
                        ) : form.role === "BRANCH_ADMIN" && getSelectedBranchName() ? (
                          `This user will manage: ${getSelectedBranchName()}`
                        ) : (
                          "Please select a branch for Branch Admin role"
                        )}
                      </div>
                    </div>
          </div>
                </Card>
              )}
          </div>
          )}

          {/* Step 3: Security Settings */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mfaEnabled"
                    name="mfaEnabled"
                    checked={form.mfaEnabled}
                    onCheckedChange={checked => setForm({ ...form, mfaEnabled: !!checked })}
                  />
                  <Label htmlFor="mfaEnabled" className="cursor-pointer">
                    Enable Multi-Factor Authentication (MFA)
                  </Label>
          </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>MFA Security:</strong> When enabled, users will receive OTP codes via email for secure login verification. 
                    This adds an extra layer of protection to their account.
                  </p>
                </div>
              </div>

              {/* Security Summary */}
              <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-green-900 dark:text-green-100">
                      Security Configuration
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {form.mfaEnabled ? "MFA enabled" : "MFA disabled"} • 
                      {form.loginCode ? ` Custom login code: ${form.loginCode}` : " Auto-generated login code"}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 1 && form.firstName && form.lastName && form.email && form.password) {
                  setStep(2)
                } else if (step === 2 && form.role && (form.role !== "BRANCH_ADMIN" || form.branchId)) {
                  setStep(3)
                }
              }}
              disabled={
                (step === 1 && (!form.firstName || !form.lastName || !form.email || !form.password)) ||
                (step === 2 && (!form.role || (form.role === "BRANCH_ADMIN" && !form.branchId)))
              }
            >
              Next
            </Button>
          ) : (
          <Button
              onClick={handleSubmit}
            disabled={submitting}
              style={{ background: "var(--color-brand-primary)", color: "white" }}
          >
              {submitting ? "Creating..." : "Create User"}
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
