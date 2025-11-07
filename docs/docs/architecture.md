# Service Architecture

## Technical Stack Deep Dive

The DataGems Frontend is engineered for efficiency, data integrity, and architectural resilience. The core technologies define the application's comprehensive performance and maintenance profile, ensuring reliable operation within data-intensive workflows.

### Framework and Architecture

The application's foundational structure is built upon **Next.js 15**, strategically utilizing the **App Router** to enforce modern rendering and data-fetching paradigms. Next.js is the designated full-stack **React framework**, managing the entire process chain encompassing routing, compilation, and code splitting. This framework selection is pivotal for maximizing performance through a **hybrid rendering strategy**. Specifically, the implementation leverages **Server Components** to execute rendering logic and initial data fetching on the server. This mechanism significantly reduces the size of the JavaScript bundle transmitted to the client and minimizes client-side computational load, reserving client resources for complex interactivity. The DataGems implementation exploits this capability to achieve a **sub-second Largest Contentful Paint (LCP)**, which is a critical performance metric for a platform displaying large, dynamic data catalogues and ensuring immediate perceived responsiveness.

### Core Development Languages

The entire codebase is constructed with **React 19** and strictly implemented using **TypeScript**. **React** provides the declarative, component-driven model necessary for managing the complex user interactions inherent in the platform, allowing for isolated state management and predictable updates. **TypeScript**, a superset of JavaScript, is a mandatory requirement across all modules. It introduces **static typing** and compilation-time checks that eliminate an entire class of runtime errors, resulting in substantial improvements to code quality, safety during large-scale refactoring operations, and overall developer experience. The enforcement of **strong typing** is essential for validating and managing the diverse and evolving **metadata schemas** associated with external datasets, thereby ensuring robust data integrity throughout the application's state management layer.

### Styling and UI Consistency

Styling is systematically implemented using **Tailwind CSS**, integrated alongside a dedicated library of **Custom UI Components**. **Tailwind CSS** operates as a utility-first framework, generating styling based on atomic utility classes applied directly within the markup. This approach replaces complex, abstracted CSS class systems with composable utility chains, effectively reducing developer context switching and minimizing the risk of unintended style regressions. This methodology ensures the rapid and precise implementation of complex visual elements, such as dynamic side panels, adaptive layouts, and state-dependent controls. The integration guarantees **high fidelity** to the design specification and absolute **visual consistency** across the entire DataGems design system.

### Security and Authentication Layer

Authentication and authorization are managed by the **NextAuth.js** library, which securely interfaces with our **Keycloak** identity provider. NextAuth.js provides a secure and flexible abstraction layer responsible for handling user sessions and **JSON Web Tokens (JWTs)**. The implementation specifically utilizes the **OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange)**. This robust security protocol mitigates the risk of token-hijacking vulnerabilities, even in public client environments like web browsers. Utilizing this industry-standard, secure flow is paramount for a platform managing access to potentially **restricted datasets**, as it ensures strict compliance with security standards and safeguards user access credentials.

### Authentication: Secure login via Keycloak

The user login mechanism is delegated entirely to the external **Keycloak** Identity and Access Management (IAM) service. The frontend initiates the login process by redirecting the user's browser to the Keycloak authorization endpoint, adhering strictly to the **OpenID Connect (OIDC)** specification. Upon successful verification of user credentials by Keycloak, the service issues an Authorization Code back to the Next.js API layer. This code is then securely exchanged for the full set of JWT tokens (ID Token, Access Token, Refresh Token) using the secured PKCE method. This separation of concerns ensures that the DataGems frontend never handles or stores sensitive user passwords, offloading the responsibility of credential management and advanced security policies (such as MFA) to the dedicated Keycloak service.

### Data Visualization and Mapping

For the accurate and efficient display of geospatial data, the frontend employs a strategic, **hybrid technology approach**. The **Google Maps API** is utilized to handle the foundational rendering of base map layers, standard location services, and familiar user interaction paradigms. This is critically combined with **MapLibre GL**, an open-source library specialized in **hardware-accelerated rendering of vector tiles**. This combination allows the platform to leverage the global coverage and quality of Google Maps while using **MapLibre GL's** capabilities to achieve superior performance when rendering **custom, data-intensive overlays** derived directly from our source datasets, avoiding the UI thread blocking and performance degradation often associated with large-scale raster rendering.

---

## Frontend Architecture Layers

The DataGems Frontend is structured into distinct, logical layers to ensure robust separation of concerns, enhance testability, and facilitate maintainability across a large application scale. The following layers govern data flow, presentation logic, and system integration.

### Presentation Layer

This layer is solely responsible for the visual rendering of the user interface and the precise handling of all direct user interaction events. The implementation utilizes **React Client Components** to manage dynamic state, process event listeners, and maintain a highly interactive user experience. Client Components execute exclusively within the user's browser environment, providing the necessary environment for managing granular element lifecycles, complex visual effects, and local component state. This distinction from Server Components is critical for features demanding immediate DOM manipulation, such as the dynamic filtering of datasets, the immediate update of the **"Selected Datasets"** panel, and the complex input handling within the **AI Chat Interface**.

### State Management Layer

Global and domain-specific application state is managed using the native **React Context API**. This method provides a centralized, yet logically partitioned, mechanism for reliable state distribution across the component tree without introducing external, monolithic state management libraries. Dedicated **Context Providers** are defined for each major application domain: **Dataset**, **Collections**, and **User**. Components retrieve necessary data and dispatch state-modifying actions via custom hooks tightly coupled to these specific Contexts. This structure ensures a straightforward and unidirectional data flow, effectively mitigating "prop drilling" while fully leveraging the native rendering optimizations provided by React for state changes. It guarantees immediate access to essential structural data, such as authentication status from the User Context, and large data structures like the current list of available Datasets.

### API Communication Layer

All network communication between the frontend client and the external backend microservices is securely routed through **Next.js API routes**. This layer functions as a mandatory intermediary, fulfilling the role of a **BFF (Backend for Frontend)** pattern. Client-side requests are dispatched to localized Next.js endpoints (e.g., `/api/datasets`). These server-side routes then execute several critical functions: they manage the secure injection of authentication tokens, handle any necessary data aggregation or transformation, and reliably forward the request to the designated upstream backend service. The utilization of Next.js API routes significantly enhances the security posture by preventing the exposure of sensitive backend service URLs and internal API keys directly to the client browser, while simultaneously allowing for precise data shaping to optimize payloads for UI consumption.

### Authentication and Authorization

User authorization is managed via **JWT-based** tokens, with the overall session lifecycle fully controlled by **NextAuth.js**, which integrates securely with the **Keycloak** identity provider. Upon successful user authentication, the system issues a **JSON Web Token (JWT)**. This token is then securely maintained and automatically attached to all subsequent outbound requests originating from the Next.js API layer. This mechanism allows for the efficient authorization of access to protected backend resources and enforces granular dataset permissions. Reliance on JWTs ensures a stateless and highly scalable authentication model, where authorization decisions can be executed by resource services with minimal latency.

### Deployment Environment

The application's deployment and operational lifecycle are strictly managed via containerization using **Docker** and orchestrated within a **Kubernetes** cluster environment. **Docker** provides standardized, immutable, and isolated environments for the Next.js application, ensuring perfect consistency between development, staging, and production environments. **Kubernetes** handles advanced service scaling, automated self-healing capabilities, and efficient load balancing across replicas. Crucially, configuration variances between deployment stages (e.g., API endpoints, security secrets) are managed meticulously using **environment overlays**. This robust container-based strategy ensures high availability, simplifies the continuous delivery pipeline, and guarantees that sensitive configuration is securely segregated across all operational stages.
