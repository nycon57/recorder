'use client';

import React from 'react';
import { X, Shield, Users, Activity } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';

interface MemberFiltersState {
  roles: string[];
  departments: string[];
  statuses: string[];
}

interface MemberFiltersProps {
  filters: MemberFiltersState;
  onFiltersChange: (filters: MemberFiltersState) => void;
  onClose: () => void;
}

const roleOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'reader', label: 'Reader' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

export function MemberFilters({ filters, onFiltersChange, onClose }: MemberFiltersProps) {
  const handleRoleChange = (role: string, checked: boolean) => {
    onFiltersChange({
      ...filters,
      roles: checked
        ? [...filters.roles, role]
        : filters.roles.filter((r) => r !== role),
    });
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    onFiltersChange({
      ...filters,
      statuses: checked
        ? [...filters.statuses, status]
        : filters.statuses.filter((s) => s !== status),
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      roles: [],
      departments: [],
      statuses: [],
    });
  };

  const hasActiveFilters =
    filters.roles.length > 0 ||
    filters.departments.length > 0 ||
    filters.statuses.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription className="text-sm">
            Narrow down your member list
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Role Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" />
              Roles
            </div>
            <div className="space-y-2">
              {roleOptions.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.value}`}
                    checked={filters.roles.includes(role.value)}
                    onCheckedChange={(checked) =>
                      handleRoleChange(role.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`role-${role.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {role.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Status Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Status
            </div>
            <div className="space-y-2">
              {statusOptions.map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={(checked) =>
                      handleStatusChange(status.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`status-${status.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Department Filters - Placeholder */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Departments
            </div>
            <p className="text-sm text-muted-foreground">
              Department filtering is available in the main search bar
            </p>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {filters.roles.map((role) => (
                  <Button
                    key={role}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRoleChange(role, false)}
                  >
                    Role: {role}
                    <X className="ml-2 h-3 w-3" />
                  </Button>
                ))}
                {filters.statuses.map((status) => (
                  <Button
                    key={status}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(status, false)}
                  >
                    Status: {status}
                    <X className="ml-2 h-3 w-3" />
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}