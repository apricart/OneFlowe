"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Plus, Pencil, Trash2, Building, ChevronRight, CheckCircle2, History, Users, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PremiumConfirmDialog } from "@/components/premium/premium-confirm-dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppContext } from "@/components/context/app-context"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Group {
    id: number
    organizationId: number
    name: string
    description: string
    status: string
    branchCount: number
    createdAt: string
    organizationName?: string
}

interface Organization {
    id: number
    name: string
}

interface Branch {
    id: number
    name: string
    organizationId: number
    groupId: number | null
    groupName?: string | null
}

export function GroupManagement({ role }: { role: string }) {
    const { toast } = useToast()
    const { organizationId: globalOrgId } = useAppContext()
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isBranchOpen, setIsBranchOpen] = useState(false)
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
    const [isDeleting, setIsDeleting] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isReleasing, setIsReleasing] = useState<number | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
    const [confirmRelease, setConfirmRelease] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

    // Form states
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [organizationId, setOrganizationId] = useState<string>("")
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([])

    // Auto-select organization from global context when opening create dialog
    useEffect(() => {
        if (isCreateOpen && globalOrgId) {
            setOrganizationId(globalOrgId)
        }
    }, [isCreateOpen, globalOrgId])

    // Data fetching

    const groupsUrl = globalOrgId
        ? `/api/v1/groups?organizationId=${globalOrgId}`
        : "/api/v1/groups"

    const { data: groupsData, error: groupsError } = useSWR(groupsUrl, fetcher, {
        revalidateOnFocus: true,
        revalidateOnMount: true,
        dedupingInterval: 2000,
    })
    const { data: orgsData } = useSWR(role === "SUPER_ADMIN" ? "/api/v1/organizations" : null, fetcher)
    const currentOrg = orgsData?.items?.find((org: Organization) => org.id.toString() === globalOrgId)

    const branchesUrl = (selectedGroup?.organizationId || globalOrgId)
        ? `/api/v1/branches?organizationId=${selectedGroup?.organizationId || globalOrgId}`
        : null
    const { data: branchesData, mutate: mutateBranches } = useSWR(
        branchesUrl,
        fetcher,
        { revalidateOnFocus: true, dedupingInterval: 2000 }
    )

    const handleCreate = async () => {
        try {
            if (!name || !organizationId) {
                toast({ title: "Error", description: "Name and Organization are required", variant: "destructive" })
                return
            }

            setIsCreating(true)
            const res = await fetch("/api/v1/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, organizationId: parseInt(organizationId) }),
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Failed to create group" }))
                console.error("Group creation failed:", errorData)
                throw new Error(errorData.error || "Failed to create group")
            }

            toast({
                title: "Success",
                description: "Group created successfully",
                variant: "success"
            })
            setIsCreateOpen(false)
            setName("")
            setDescription("")
            setOrganizationId("")
            mutate(groupsUrl)
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setIsCreating(false)
        }
    }

    const handleUpdate = async () => {
        try {
            if (!selectedGroup) return
            setIsUpdating(true)

            const res = await fetch(`/api/v1/groups/${selectedGroup.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description }),
            })

            if (!res.ok) throw new Error(await res.text())

            toast({
                title: "Success",
                description: "Group updated successfully",
                variant: "success"
            })
            setIsEditOpen(false)
            mutate(groupsUrl)
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            setIsDeleting(id)
            const res = await fetch(`/api/v1/groups/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Deletion failed" }))
                throw new Error(errorData.error || "Deletion failed")
            }

            toast({
                title: "Deleted",
                description: "Group has been removed successfully",
                variant: "default"
            })
            mutate(groupsUrl)
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setIsDeleting(null)
            setConfirmDelete({ open: false, id: null })
        }
    }

    const handleManageBranches = async () => {
        try {
            if (!selectedGroup) return
            setIsSaving(true)
            const res = await fetch(`/api/v1/groups/${selectedGroup.id}/branches`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchIds: selectedBranchIds }),
            })

            if (!res.ok) throw new Error(await res.text())

            toast({ title: "Success", description: "Branches assigned successfully" })
            setIsBranchOpen(false)
            mutate(groupsUrl)
            mutateBranches()
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const handleReleaseBranch = async (branchId: number) => {
        try {
            setIsReleasing(branchId)
            const res = await fetch(`/api/v1/branches/${branchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId: null }),
            })

            if (!res.ok) throw new Error("Failed to release branch")

            toast({
                title: "Branch Released",
                description: "Branch is now independent",
                variant: "success"
            })
            mutate(groupsUrl)
            mutateBranches()
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setIsReleasing(null)
            setConfirmRelease({ open: false, id: null })
        }
    }

    const openEdit = (group: Group) => {
        setSelectedGroup(group)
        setName(group.name)
        setDescription(group.description)
        setIsEditOpen(true)
    }

    const openBranchManager = (group: Group) => {
        setSelectedGroup(group)

        // Derive selection from already-loaded branches data (instant, no extra fetch)
        const assignedIds = branchesData?.items
            ?.filter((b: Branch) => b.groupId === group.id)
            .map((b: Branch) => b.id) || []
        setSelectedBranchIds(assignedIds)

        setIsBranchOpen(true)
        mutateBranches()
    }

    if (groupsError) return <div>Failed to load groups</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building className="text-blue-600" />
                        Group Management
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Manage branch groups for reporting and analytics</p>
                </div>
                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all hover:scale-105">
                        <Plus className="mr-2 h-4 w-4" /> Create Group
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <TableRow>
                            <TableHead className="font-bold">Group Name</TableHead>
                            {role === "SUPER_ADMIN" && <TableHead className="font-bold">Organization</TableHead>}
                            <TableHead className="font-bold">Description</TableHead>
                            <TableHead className="font-bold">Branches</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="text-right font-bold w-[150px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupsData?.groups?.map((group: Group) => (
                            <TableRow key={group.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group cursor-default">
                                <TableCell className="font-medium text-slate-900 dark:text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                            {group.name.charAt(0)}
                                        </div>
                                        {group.name}
                                    </div>
                                </TableCell>
                                {role === "SUPER_ADMIN" && (
                                    <TableCell>
                                        <Badge variant="outline" className="font-medium bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400">
                                            {group.organizationName}
                                        </Badge>
                                    </TableCell>
                                )}
                                <TableCell className="text-slate-500 max-w-xs truncate">{group.description}</TableCell>
                                <TableCell>
                                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-none font-bold px-3">
                                        {group.branchCount} branches
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge className={
                                        group.status === "connected"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none px-3 font-bold"
                                            : group.status === "not connected"
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-none px-3 font-bold"
                                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-none px-3"
                                    }>
                                        {group.status === "connected" ? "Connected" : group.status === "not connected" ? "Not Connected" : group.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openBranchManager(group)} title="Manage Branches" className="hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                                            <Users className="h-4 w-4" />
                                        </Button>
                                        {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(group)} className="hover:bg-amber-50 hover:text-amber-600 rounded-lg">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete({ open: true, id: group.id })} disabled={isDeleting === group.id} className="hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                                                    <Trash2 className={`h-4 w-4 ${isDeleting === group.id ? "animate-spin" : ""}`} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!groupsData?.groups || groupsData.groups.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-slate-500 italic">
                                    No groups found for this organization.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Create New Group</DialogTitle>
                        <DialogDescription>Add a new branch group for your organization.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="org">Organization</Label>
                            {globalOrgId ? (
                                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <Building className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {currentOrg?.name || "Selected Organization"}
                                        </span>
                                    </div>
                                    <Badge variant="secondary" className="bg-blue-100/50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-none">Active</Badge>
                                </div>
                            ) : (
                                <Select onValueChange={setOrganizationId} value={organizationId}>
                                    <SelectTrigger id="org" className="rounded-xl">
                                        <SelectValue placeholder="Select organization" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {orgsData?.items?.map((org: Organization) => (
                                            <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Group Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown Stores" className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc">Description</Label>
                            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Group purpose..." className="rounded-xl resize-none h-24" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreate} disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6">
                            {isCreating ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Edit Group</DialogTitle>
                        <DialogDescription>Modify group details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Group Name</Label>
                            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-desc">Description</Label>
                            <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl resize-none h-24" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6">
                            {isUpdating ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Branch Assignment Dialog */}
            <Dialog open={isBranchOpen} onOpenChange={setIsBranchOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Assign Branches - {selectedGroup?.name}</DialogTitle>
                        <DialogDescription>Select branches to include in this group.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block font-semibold text-slate-700 dark:text-slate-300">Available Branches</Label>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                            <ScrollArea className="h-[300px] p-4">
                                <div className="space-y-3">
                                    {branchesData?.items?.map((branch: Branch) => (
                                        <div key={branch.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                                            <Checkbox
                                                id={`branch-${branch.id}`}
                                                checked={selectedBranchIds.includes(branch.id)}
                                                disabled={!!(branch.groupId && branch.groupId !== selectedGroup?.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedBranchIds([...selectedBranchIds, branch.id])
                                                    } else {
                                                        setSelectedBranchIds(selectedBranchIds.filter(id => id !== branch.id))
                                                    }
                                                }}
                                                className="rounded-md border-slate-300 text-blue-600 data-[state=checked]:bg-blue-600"
                                            />
                                            <Label htmlFor={`branch-${branch.id}`} className="cursor-pointer flex-1 font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                                                {branch.name}
                                                {branch.groupId && branch.groupId !== selectedGroup?.id && (
                                                    <div className="flex items-center justify-between mt-1 text-[10px]">
                                                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 py-0 px-1.5 h-5">
                                                            In group: {branch.groupName || `Group #${branch.groupId}`}
                                                        </Badge>
                                                        <span className="text-[10px] text-slate-500 ml-2">
                                                            Go to that group to release this branch
                                                        </span>
                                                    </div>
                                                )}
                                            </Label>
                                        </div>
                                    ))}
                                    {(!branchesData?.items || branchesData.items.length === 0) && (
                                        <div className="text-center py-12 text-slate-400">No branches found for this organization.</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                        <p className="mt-4 text-xs text-slate-500 flex items-start gap-2">
                            <History size={14} className="mt-0.5 text-blue-500" />
                            Note: A branch can only belong to one group at a time. Assigning a branch to this group will remove it from its previous group.
                        </p>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 flex items-center">
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsBranchOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button
                                onClick={handleManageBranches}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 shadow-lg shadow-blue-500/20"
                            >
                                {isSaving ? (
                                    <>Saving...</>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Save Assignments
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Premium Confirm Dialogs */}
            <PremiumConfirmDialog
                open={confirmDelete.open}
                onOpenChange={(v) => !isDeleting && setConfirmDelete({ open: v, id: confirmDelete.id })}
                onConfirm={() => confirmDelete.id && handleDelete(confirmDelete.id)}
                title="Delete Group?"
                description="This action cannot be undone. All branches assigned to this group will become independent."
                confirmText="Delete Group"
                type="danger"
                isLoading={isDeleting !== null}
            />

            <PremiumConfirmDialog
                open={confirmRelease.open}
                onOpenChange={(v) => !isReleasing && setConfirmRelease({ open: v, id: confirmRelease.id })}
                onConfirm={() => confirmRelease.id && handleReleaseBranch(confirmRelease.id)}
                title="Release Branch?"
                description="This branch will be removed from the group and return to the independent branch pool."
                confirmText="Release"
                type="warning"
                isLoading={isReleasing !== null}
            />
        </div>
    )
}
