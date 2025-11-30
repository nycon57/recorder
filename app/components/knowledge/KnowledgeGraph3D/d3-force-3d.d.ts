/**
 * Type declarations for d3-force-3d
 *
 * d3-force-3d does not ship with TypeScript declarations.
 * These minimal declarations cover the APIs we use.
 */

declare module 'd3-force-3d' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface SimulationNode {
    // Minimal interface - d3-force-3d mutates nodes with x,y,z
    // All additional properties are allowed via index signature
  }

  export interface SimulationLink<NodeType extends SimulationNode = SimulationNode> {
    source: string | NodeType;
    target: string | NodeType;
    [key: string]: unknown;
  }

  export interface Force<NodeType extends SimulationNode = SimulationNode> {
    (alpha: number): void;
  }

  export interface ForceLink<NodeType extends SimulationNode = SimulationNode> extends Force<NodeType> {
    links(): SimulationLink<NodeType>[];
    links(links: SimulationLink<NodeType>[]): this;
    id(): (node: NodeType) => string | number;
    id(id: (node: NodeType) => string | number): this;
    distance(): (link: SimulationLink<NodeType>) => number;
    distance(distance: number | ((link: SimulationLink<NodeType>) => number)): this;
    strength(): (link: SimulationLink<NodeType>) => number;
    strength(strength: number | ((link: SimulationLink<NodeType>) => number)): this;
  }

  export interface ForceManyBody<NodeType extends SimulationNode = SimulationNode> extends Force<NodeType> {
    strength(): number;
    strength(strength: number | ((node: NodeType) => number)): this;
  }

  export interface ForceCenter<NodeType extends SimulationNode = SimulationNode> extends Force<NodeType> {
    x(): number;
    x(x: number): this;
    y(): number;
    y(y: number): this;
    z(): number;
    z(z: number): this;
    strength(): number;
    strength(strength: number): this;
  }

  export interface ForceZ<NodeType extends SimulationNode = SimulationNode> extends Force<NodeType> {
    z(): number;
    z(z: number): this;
    strength(): number;
    strength(strength: number): this;
  }

  export interface Simulation<NodeType extends SimulationNode = SimulationNode> {
    nodes(): NodeType[];
    nodes(nodes: NodeType[]): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaMin(): number;
    alphaMin(min: number): this;
    alphaDecay(): number;
    alphaDecay(decay: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    velocityDecay(): number;
    velocityDecay(decay: number): this;
    force(name: string): Force<NodeType> | undefined;
    force(name: string, force: Force<NodeType> | null): this;
    find(x: number, y: number, z?: number, radius?: number): NodeType | undefined;
    on(typenames: string): (() => void) | undefined;
    on(typenames: string, listener: (() => void) | null): this;
    restart(): this;
    stop(): this;
    tick(iterations?: number): this;
  }

  export function forceSimulation<NodeType extends SimulationNode = SimulationNode>(
    nodes?: NodeType[],
    numDimensions?: number
  ): Simulation<NodeType>;

  export function forceLink<NodeType extends SimulationNode = SimulationNode>(
    links?: SimulationLink<NodeType>[]
  ): ForceLink<NodeType>;

  export function forceManyBody<NodeType extends SimulationNode = SimulationNode>(): ForceManyBody<NodeType>;

  export function forceCenter<NodeType extends SimulationNode = SimulationNode>(
    x?: number,
    y?: number,
    z?: number
  ): ForceCenter<NodeType>;

  export function forceZ<NodeType extends SimulationNode = SimulationNode>(
    z?: number
  ): ForceZ<NodeType>;
}
