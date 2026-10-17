declare module 'google-robotstxt-parser' {
  export class RobotsMatcher {
    oneAgentAllowedByRobots(robotsText: string, userAgent: string, url: string): boolean;
  }
}