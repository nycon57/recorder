import Link from 'next/link';

import { ArrowRight, Route, Send } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import type {
  ReviewQueueManualPublicationItem,
  ReviewQueueRoutingItem,
} from '@/lib/services/review-queue';

export function ReviewQueueItemCard({
  item,
}: {
  item: ReviewQueueRoutingItem | ReviewQueueManualPublicationItem;
}) {
  const isRoutingItem = item.kind === 'routing';
  const secondaryAction = isRoutingItem ? item.secondaryAction : undefined;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{item.title}</CardTitle>
            <CardDescription className="mt-1">{item.summary}</CardDescription>
          </div>
          <Badge variant="outline">
            {isRoutingItem ? 'Needs Routing' : 'Manual Publication'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isRoutingItem ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              App: {item.app ?? 'Unassigned'}
            </Badge>
            <Badge variant="outline">
              Screen: {item.screen ?? 'Unassigned'}
            </Badge>
            <Badge variant="outline">
              {item.sourceCount} linked {item.sourceCount === 1 ? 'source' : 'sources'}
            </Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {item.connectorCount} connected {item.connectorCount === 1 ? 'destination' : 'destinations'}
            </Badge>
            <Badge variant="outline">Library publish flow</Badge>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={item.primaryAction.href}>
              {isRoutingItem ? (
                <Route className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {item.primaryAction.label}
            </Link>
          </Button>
          {secondaryAction ? (
            <Button asChild variant="outline" size="sm">
              <Link href={secondaryAction.href}>
                {secondaryAction.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
