'use client';

import * as motion from 'motion/react-client';
import { Check, X, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import type { ComparisonData } from '@/lib/data/features';

/**
 * FeatureComparison - Comparison table vs competitors
 */

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

interface FeatureComparisonProps {
  data: ComparisonData;
}

export function FeatureComparison({ data }: FeatureComparisonProps) {
  const renderCellValue = (value: boolean | string, isTriboraColumn = false) => {
    if (typeof value === 'boolean') {
      return value ? (
        <div
          className={cn(
            'w-6 h-6 rounded-full mx-auto',
            'flex items-center justify-center',
            isTriboraColumn ? 'bg-accent/20' : 'bg-muted/30'
          )}
        >
          <Check
            className={cn(
              'h-4 w-4',
              isTriboraColumn ? 'text-accent' : 'text-muted-foreground'
            )}
          />
        </div>
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
      );
    }

    if (value === 'N/A') {
      return <span className="text-muted-foreground/50">N/A</span>;
    }

    return (
      <span
        className={cn(
          'text-sm',
          isTriboraColumn ? 'font-semibold text-accent' : 'text-muted-foreground'
        )}
      >
        {value}
      </span>
    );
  };

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bottom-[30%] right-[10%] w-[500px] h-[500px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-2 rounded-full
                bg-accent/5 backdrop-blur-sm border-accent/30"
            >
              <Zap className="h-4 w-4 mr-2 text-accent" />
              <span className="text-sm font-medium text-accent">Comparison</span>
            </Badge>

            <h2
              className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-light
                leading-tight tracking-tight mb-4"
            >
              <span className="text-foreground">{data.headline}</span>
            </h2>

            <p className="text-lg text-muted-foreground font-light">
              {data.subtitle}
            </p>
          </motion.div>

          {/* Comparison Table */}
          <motion.div
            variants={itemVariants}
            className={cn(
              'rounded-2xl overflow-hidden',
              'bg-card/50 backdrop-blur-sm',
              'border border-border/50',
              'shadow-[0_0_60px_rgba(0,223,130,0.05)]'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[40%]">
                      Feature
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm w-[20%]">
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent to-secondary
                            flex items-center justify-center"
                        >
                          <span className="text-accent-foreground font-bold text-xs">T</span>
                        </div>
                        <span className="text-accent">Tribora</span>
                      </div>
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[20%]">
                      {data.competitors[0]}
                    </th>
                    <th className="text-center p-4 sm:p-6 font-medium text-sm text-muted-foreground w-[20%]">
                      {data.competitors[1]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <motion.tr
                      key={index}
                      variants={itemVariants}
                      className={cn(
                        'border-b border-border/30 last:border-0',
                        'transition-colors duration-300',
                        'hover:bg-accent/5'
                      )}
                    >
                      <td className="p-4 sm:p-6 text-sm font-medium">
                        {row.feature}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {renderCellValue(row.tribora, true)}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {renderCellValue(row.competitor1)}
                      </td>
                      <td className="p-4 sm:p-6 text-center">
                        {renderCellValue(row.competitor2)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
