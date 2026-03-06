{{/*
Expand the name of the chart.
*/}}
{{- define "guhatek-onegt.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "guhatek-onegt.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "guhatek-onegt.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "guhatek-onegt.labels" -}}
helm.sh/chart: {{ include "guhatek-onegt.chart" . }}
{{ include "guhatek-onegt.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "guhatek-onegt.selectorLabels" -}}
app.kubernetes.io/name: {{ include "guhatek-onegt.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "guhatek-onegt.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "guhatek-onegt.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Google credentials secret name
*/}}
{{- define "guhatek-onegt.credentialsSecretName" -}}
{{- default (printf "%s-credentials" (include "guhatek-onegt.fullname" .)) .Values.googleCredentials.secretName }}
{{- end }}
