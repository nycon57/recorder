import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cloud,
  Code2,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MonitorSmartphone,
  RotateCcw,
  ShieldCheck,
  Upload,
  UserRound,
  Webhook,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';

type DepartmentOption = {
  id?: string;
  name?: string;
};

type InviteMemberModalProps = {
  open: boolean;
  onClose: () => void;
  departments?: DepartmentOption[];
};

const EMPTY_DEPARTMENTS: DepartmentOption[] = [];

const externalSources = [
  {
    name: 'Browser extension',
    description: 'Capture page context and send useful knowledge back to Tribora.',
    icon: Cloud,
  },
  {
    name: 'File uploads',
    description: 'Bring documents, transcripts, and reference material into the library.',
    icon: Upload,
  },
  {
    name: 'Shared links',
    description: 'Save web pages and vendor docs for later search and review.',
    icon: Link2,
  },
];

const apiScopes = ['Read content', 'Create imports', 'Search knowledge'];

const webhookEvents = ['content.created', 'recording.processed', 'wiki.updated'];

export function InviteMemberModal({
  open,
  onClose,
  departments = EMPTY_DEPARTMENTS,
}: InviteMemberModalProps) {
  const departmentLabel =
    departments.length > 0
      ? `${departments.length} departments available`
      : 'Departments can be assigned after invite';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an organization invite and assign role details after acceptance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" placeholder="teammate@company.com" />
          </div>
          <div className="rounded-sm border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            {departmentLabel}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>
            <Mail className="size-4" />
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExternalSourcesTab() {
  return (
    <div className="grid gap-3">
      {externalSources.map((source) => {
        const Icon = source.icon;
        return (
          <div key={source.name} className="flex items-start gap-3 rounded-sm border border-border bg-background p-4">
            <Icon className="mt-1 size-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">{source.name}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{source.description}</p>
            </div>
            <Badge variant="outline" className="ml-auto">
              Ready
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function ApiKeysTab() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Programmatic access</p>
          <p className="text-sm text-muted-foreground">
            Create scoped keys for trusted internal tools and automations.
          </p>
        </div>
        <Button>
          <KeyRound className="size-4" />
          Generate key
        </Button>
      </div>
      <Separator />
      <div className="grid gap-2">
        {apiScopes.map((scope) => (
          <div key={scope} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            {scope}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WebhooksTab() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Webhook endpoints</p>
          <p className="text-sm text-muted-foreground">
            Notify external systems when organization knowledge changes.
          </p>
        </div>
        <Button>
          <Webhook className="size-4" />
          Add endpoint
        </Button>
      </div>
      <div className="grid gap-2">
        {webhookEvents.map((eventName) => (
          <div key={eventName} className="rounded-sm border border-border bg-background p-3">
            <code className="text-sm text-foreground">{eventName}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileForm() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" placeholder="Your name" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" placeholder="you@company.com" />
      </div>
      <div className="md:col-span-2">
        <Button>
          <UserRound className="size-4" />
          Save profile
        </Button>
      </div>
    </div>
  );
}

export function AvatarUpload() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-16 items-center justify-center rounded-sm border border-border bg-muted/20">
        <UserRound className="size-7 text-muted-foreground" />
      </div>
      <div>
        <Button variant="outline">
          <Upload className="size-4" />
          Upload image
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">Use a square image for best results.</p>
      </div>
    </div>
  );
}

export function PreferencesForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Choose default account behavior for notifications and display.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PreferenceRow icon={Bell} title="Weekly digest" description="Receive a summary of new recordings and wiki updates." />
        <PreferenceRow icon={MonitorSmartphone} title="Compact tables" description="Use denser tables across dashboard views." />
        <PreferenceRow icon={RotateCcw} title="Resume last tab" description="Open settings pages where you left off." />
      </CardContent>
    </Card>
  );
}

export function SessionsList() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-sm border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="size-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Current device</p>
            <p className="text-sm text-muted-foreground">Active browser session</p>
          </div>
        </div>
        <Badge variant="outline">Active</Badge>
      </div>
    </div>
  );
}

export function SecuritySettings() {
  return (
    <div className="grid gap-3">
      <SecurityRow icon={LockKeyhole} title="Password" description="Use your authentication provider to update credentials." />
      <SecurityRow icon={ShieldCheck} title="Two-step verification" description="Add another verification step for account access." />
      <SecurityRow icon={Code2} title="API access" description="Review API keys from the integrations page." />
    </div>
  );
}

export function DangerZone() {
  return (
    <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 size-5 text-destructive" />
        <div>
          <p className="font-medium text-foreground">Account deletion</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Contact an organization admin before removing your account or transferring ownership.
          </p>
          <Button variant="destructive" className="mt-4">
            Request deletion
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-border bg-background p-4">
      <Icon className="mt-1 size-5 text-primary" />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SecurityRow(props: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return <PreferenceRow {...props} />;
}
